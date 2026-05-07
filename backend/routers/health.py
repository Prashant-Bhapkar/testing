from fastapi import APIRouter
import services.storage as storage
import services.embedding as embedding

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/health/full")
def full_health():
    return {
        "api": "ok",
        "minio": storage.check_minio(),
        "qdrant": embedding.check_qdrant(),
        "ai": embedding.check_ai(),
    }
