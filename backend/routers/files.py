import io
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from minio.error import S3Error

import services.storage as storage
import services.embedding as embedding
from services.auth import get_current_user, require_admin
from config import MINIO_BUCKET

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

MIME_MAP = {
    "pdf": "application/pdf", "png": "image/png",
    "jpg": "image/jpeg", "jpeg": "image/jpeg",
    "gif": "image/gif", "svg": "image/svg+xml",
    "txt": "text/plain", "csv": "text/csv", "md": "text/plain",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

EMBEDDABLE_EXTENSIONS = {"pdf", "txt", "md", "csv", "docx"}


def _attach_uploaders(items: list) -> None:
    """Populate uploaded_by field on file items from the file_uploads table."""
    file_paths = [i["path"] for i in items if i["type"] == "file"]
    if not file_paths:
        return
    from services import database
    conn = database.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT object_name, uploaded_by FROM file_uploads WHERE object_name = ANY(%s)",
            (file_paths,),
        )
        upload_map = {r[0]: r[1] for r in cur.fetchall()}
    finally:
        cur.close()
        database.release_conn(conn)
    for item in items:
        if item["type"] == "file":
            item["uploaded_by"] = upload_map.get(item["path"])


def _record_upload(object_name: str, username: str) -> None:
    """Upsert uploader info into file_uploads table."""
    from services import database
    conn = database.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO file_uploads (object_name, uploaded_by) VALUES (%s, %s)"
            " ON CONFLICT (object_name) DO UPDATE SET uploaded_by = EXCLUDED.uploaded_by, uploaded_at = NOW()",
            (object_name, username),
        )
        conn.commit()
    except Exception:
        conn.rollback()
    finally:
        cur.close()
        database.release_conn(conn)


def _remove_upload_records(object_names: list) -> None:
    """Delete file_uploads entries for given object names."""
    if not object_names:
        return
    from services import database
    conn = database.get_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM file_uploads WHERE object_name = ANY(%s)", (object_names,))
        conn.commit()
    except Exception:
        conn.rollback()
    finally:
        cur.close()
        database.release_conn(conn)


@router.get("/browse")
def browse(prefix: str = "", user: dict = Depends(get_current_user)):
    try:
        items = storage.list_objects(prefix)
        _attach_uploaders(items)
        return {"bucket": MINIO_BUCKET, "prefix": prefix, "items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bucket-info")
def bucket_info(user: dict = Depends(get_current_user)):
    try:
        count = storage.bucket_root_count()
        return {"bucket": MINIO_BUCKET, "root_items": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
def search(q: str = "", user: dict = Depends(get_current_user)):
    if not q.strip():
        return {"items": []}
    try:
        items = storage.search_all(q.strip())
        _attach_uploaders(items)
        return {"items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload(request: Request, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    try:
        form        = await request.form()
        file        = form.get("file")
        prefix      = form.get("prefix", "")
        if not file:
            raise HTTPException(status_code=400, detail="No file provided")

        content      = await file.read()
        object_name  = f"{prefix}{file.filename}" if prefix else file.filename
        content_type = file.content_type or "application/octet-stream"
        ext          = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""

        storage.upload_object(object_name, content, content_type)
        _record_upload(object_name, user["sub"])
        logger.info("Uploaded: %s  size=%d bytes  embed=%s  by=%s",
                    object_name, len(content), ext in EMBEDDABLE_EXTENSIONS, user["sub"])

        result = {"status": "uploaded", "object_name": object_name,
                  "size": len(content), "embedding": None}

        if ext in EMBEDDABLE_EXTENSIONS:
            background_tasks.add_task(embedding.embed_document, content, object_name)
            result["embedding"] = {"status": "queued"}

        return result
    except S3Error as e:
        raise HTTPException(status_code=500, detail=f"MinIO error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download")
def download(path: str, user: dict = Depends(get_current_user)):
    try:
        data     = storage.download_object(path)
        filename = path.split("/")[-1]
        return StreamingResponse(
            io.BytesIO(data), media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/preview")
def preview(path: str, user: dict = Depends(get_current_user)):
    try:
        data = storage.download_object(path)
        ext  = path.rsplit(".", 1)[-1].lower() if "." in path else ""
        return StreamingResponse(io.BytesIO(data), media_type=MIME_MAP.get(ext, "application/octet-stream"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete")
def delete(path: str, admin: dict = Depends(require_admin)):
    try:
        filename = Path(path).name
        ext      = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        storage.delete_object(path)
        _remove_upload_records([path])
        result = {"status": "deleted", "path": path, "embeddings_deleted": False}
        if ext in EMBEDDABLE_EXTENSIONS:
            embedding.delete_embeddings_for_file(filename)
            result["embeddings_deleted"] = True
        logger.info("Deleted file: %s  embeddings_cleaned=%s  by=%s",
                    path, result["embeddings_deleted"], admin["sub"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete-folder")
def delete_folder(path: str, admin: dict = Depends(require_admin)):
    try:
        deleted = storage.delete_folder_all(path)
        cleaned = []
        real_files = [p for p in deleted if not p.endswith("/.keep") and not p.endswith(".keep")]
        for obj_name in deleted:
            filename = Path(obj_name).name
            ext      = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
            if ext in EMBEDDABLE_EXTENSIONS:
                embedding.delete_embeddings_for_file(filename)
                cleaned.append(filename)
        _remove_upload_records(deleted)
        logger.info("Deleted folder: %s  files=%d  embeds_cleaned=%d  by=%s",
                    path, len(real_files), len(cleaned), admin["sub"])
        return {"status": "deleted", "folder": path,
                "files_deleted": len(real_files), "embeddings_cleaned": cleaned}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class FolderRequest(BaseModel):
    prefix: str = ""
    folder_name: str


@router.post("/create-folder")
def create_folder(body: FolderRequest, user: dict = Depends(get_current_user)):
    try:
        name = body.folder_name.strip().strip("/")
        if not name:
            raise HTTPException(status_code=400, detail="Folder name is required")
        folder = storage.create_folder_placeholder(body.prefix, name)
        return {"status": "created", "folder": folder}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/embedding-status")
def embedding_status(filename: str, user: dict = Depends(get_current_user)):
    count = embedding.count_embeddings_for_file(filename)
    return {"filename": filename, "chunks_embedded": count, "is_embedded": count > 0}


class ReEmbedRequest(BaseModel):
    path: str


@router.post("/re-embed")
def re_embed(body: ReEmbedRequest, admin: dict = Depends(require_admin)):
    try:
        filename = Path(body.path).name
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in EMBEDDABLE_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"'{ext}' files are not embeddable")
        data   = storage.download_object(body.path)
        result = embedding.embed_document(data, body.path)
        logger.info("Re-embed: %s  by=%s", body.path, admin["sub"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
