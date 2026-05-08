import io
import urllib3
from minio import Minio
from config import MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_SECURE, MINIO_BUCKET


def get_minio() -> Minio:
    return Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_SECURE,
        http_client=urllib3.PoolManager(cert_reqs="CERT_NONE", assert_hostname=False),
    )


def list_objects(prefix: str = ""):
    client = get_minio()
    folders, files = [], []
    for obj in client.list_objects(MINIO_BUCKET, prefix=prefix, recursive=False):
        name = obj.object_name
        rel  = name[len(prefix):]
        if not rel:
            continue
        if rel.endswith("/"):
            folder_name = rel.rstrip("/")
            if folder_name:
                folders.append({"name": folder_name, "path": name, "type": "folder",
                                 "size": None, "modified": None, "ext": "",
                                 "uploaded_by": None})
        else:
            if rel == ".keep":
                continue
            ext = rel.rsplit(".", 1)[-1].lower() if "." in rel else ""
            files.append({"name": rel, "path": name, "type": "file",
                           "size": obj.size, "ext": ext,
                           "modified": obj.last_modified.isoformat() if obj.last_modified else None,
                           "uploaded_by": None})
    folders.sort(key=lambda x: x["name"].lower())
    files.sort(key=lambda x: x["name"].lower())
    return folders + files


def upload_object(object_name: str, data: bytes, content_type: str):
    client = get_minio()
    client.put_object(
        bucket_name=MINIO_BUCKET,
        object_name=object_name,
        data=io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )


def download_object(path: str) -> bytes:
    client = get_minio()
    resp = client.get_object(MINIO_BUCKET, path)
    data = resp.read()
    resp.close()
    resp.release_conn()
    return data


def delete_object(path: str):
    client = get_minio()
    client.remove_object(MINIO_BUCKET, path)


def list_objects_recursive(prefix: str):
    client = get_minio()
    return list(client.list_objects(MINIO_BUCKET, prefix=prefix, recursive=True))


def delete_folder_all(prefix: str) -> list:
    """Delete all objects under prefix. Returns list of deleted object names.
    Handles empty folders by explicitly attempting .keep placeholder deletion."""
    client = get_minio()
    prefix_slash = prefix if prefix.endswith("/") else prefix + "/"
    objects = list(client.list_objects(MINIO_BUCKET, prefix=prefix_slash, recursive=True))
    deleted = []
    for obj in objects:
        client.remove_object(MINIO_BUCKET, obj.object_name)
        deleted.append(obj.object_name)
    # Explicit fallback for the .keep placeholder in case recursive listing missed it
    keep_path = prefix_slash + ".keep"
    if keep_path not in deleted:
        try:
            client.remove_object(MINIO_BUCKET, keep_path)
            deleted.append(keep_path)
        except Exception:
            pass
    return deleted


def search_all(query: str) -> list:
    """Recursively search all objects in the bucket by filename or path."""
    client = get_minio()
    q = query.lower()
    results = []
    for obj in client.list_objects(MINIO_BUCKET, recursive=True):
        name = obj.object_name
        if name.endswith("/"):
            continue
        filename = name.split("/")[-1]
        if filename == ".keep":
            continue
        if q in filename.lower() or q in name.lower():
            ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
            results.append({
                "name": filename,
                "path": name,
                "type": "file",
                "size": obj.size,
                "ext": ext,
                "modified": obj.last_modified.isoformat() if obj.last_modified else None,
                "uploaded_by": None,
            })
    results.sort(key=lambda x: x["name"].lower())
    return results


def create_folder_placeholder(prefix: str, folder_name: str):
    client = get_minio()
    placeholder = f"{prefix}{folder_name}/.keep"
    client.put_object(
        bucket_name=MINIO_BUCKET,
        object_name=placeholder,
        data=io.BytesIO(b""),
        length=0,
    )
    return f"{prefix}{folder_name}/"


def bucket_root_count() -> int:
    client = get_minio()
    return len(list(client.list_objects(MINIO_BUCKET, recursive=False)))


def check_minio() -> str:
    try:
        get_minio().bucket_exists(MINIO_BUCKET)
        return "ok"
    except Exception as e:
        return f"error: {str(e)[:120]}"
