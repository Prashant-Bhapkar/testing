import io
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from minio.error import S3Error

import services.storage as storage
import services.embedding as embedding
from config import MINIO_BUCKET

router = APIRouter(prefix="/api")

MIME_MAP = {
    "pdf": "application/pdf", "png": "image/png",
    "jpg": "image/jpeg", "jpeg": "image/jpeg",
    "gif": "image/gif", "svg": "image/svg+xml",
    "txt": "text/plain", "csv": "text/csv", "md": "text/plain",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

EMBEDDABLE_EXTENSIONS = {"pdf", "txt", "md", "csv", "docx"}


@router.get("/browse")
def browse(prefix: str = ""):
    try:
        items = storage.list_objects(prefix)
        return {"bucket": MINIO_BUCKET, "prefix": prefix, "items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bucket-info")
def bucket_info():
    try:
        count = storage.bucket_root_count()
        return {"bucket": MINIO_BUCKET, "root_items": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload(request: Request, background_tasks: BackgroundTasks):
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
def download(path: str):
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
def preview(path: str):
    try:
        data = storage.download_object(path)
        ext  = path.rsplit(".", 1)[-1].lower() if "." in path else ""
        return StreamingResponse(io.BytesIO(data), media_type=MIME_MAP.get(ext, "application/octet-stream"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete")
def delete(path: str):
    try:
        filename = Path(path).name
        ext      = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        storage.delete_object(path)
        result = {"status": "deleted", "path": path, "embeddings_deleted": False}
        if ext in EMBEDDABLE_EXTENSIONS:
            embedding.delete_embeddings_for_file(filename)
            result["embeddings_deleted"] = True
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete-folder")
def delete_folder(path: str):
    try:
        objects  = storage.list_objects_recursive(path)
        deleted, cleaned = [], []
        for obj in objects:
            obj_name = obj.object_name
            filename = Path(obj_name).name
            ext      = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
            storage.delete_object(obj_name)
            deleted.append(obj_name)
            if ext in EMBEDDABLE_EXTENSIONS:
                embedding.delete_embeddings_for_file(filename)
                cleaned.append(filename)
        return {"status": "deleted", "folder": path,
                "files_deleted": len(deleted), "embeddings_cleaned": cleaned}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class FolderRequest(BaseModel):
    prefix: str = ""
    folder_name: str


@router.post("/create-folder")
def create_folder(body: FolderRequest):
    try:
        name = body.folder_name.strip().strip("/")
        if not name:
            raise HTTPException(status_code=400, detail="Folder name is required")
        folder = storage.create_folder_placeholder(body.prefix, name)
        return {"status": "created", "folder": folder}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/embedding-status")
def embedding_status(filename: str):
    count = embedding.count_embeddings_for_file(filename)
    return {"filename": filename, "chunks_embedded": count, "is_embedded": count > 0}


class ReEmbedRequest(BaseModel):
    path: str


@router.post("/re-embed")
def re_embed(body: ReEmbedRequest):
    try:
        filename = Path(body.path).name
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in EMBEDDABLE_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"'{ext}' files are not embeddable")
        data   = storage.download_object(body.path)
        result = embedding.embed_document(data, body.path)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
