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
                                 "size": None, "modified": None, "ext": ""})
        else:
            if rel == ".keep":
                continue
            ext = rel.rsplit(".", 1)[-1].lower() if "." in rel else ""
            files.append({"name": rel, "path": name, "type": "file",
                           "size": obj.size, "ext": ext,
                           "modified": obj.last_modified.isoformat() if obj.last_modified else None})
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
