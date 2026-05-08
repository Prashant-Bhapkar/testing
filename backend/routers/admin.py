import os
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.auth import require_admin
from services import database
import services.storage as storage
import services.embedding as embedding

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin")

CONFIGURABLE_KEYS: dict[str, str] = {
    "MINIO_ENDPOINT":    "MinIO server endpoint URL",
    "MINIO_ACCESS_KEY":  "MinIO access key (username)",
    "MINIO_SECRET_KEY":  "MinIO secret key (password)",
    "MINIO_BUCKET":      "MinIO bucket name",
    "MINIO_SECURE":      "MinIO use HTTPS (true/false)",
    "QDRANT_URL":        "Qdrant vector database URL",
    "AI_BASE_URL":       "AI API base URL",
    "OPENAI_API_KEY":    "AI API key / token",
    "EMBEDDING_MODEL":   "Embedding model name",
    "CHAT_MODEL":        "Chat / completion model name",
    "COLLECTION_NAME":   "Qdrant collection name",
    "CHUNK_SIZE":        "Document chunk size (characters)",
    "CHUNK_OVERLAP":     "Overlap between chunks (characters)",
    "POSTGRES_HOST":     "PostgreSQL host",
    "POSTGRES_PORT":     "PostgreSQL port",
    "POSTGRES_USER":     "PostgreSQL username",
    "POSTGRES_PASSWORD": "PostgreSQL password",
    "POSTGRES_DB":       "PostgreSQL database name",
    "JWT_SECRET":        "JWT signing secret (keep private)",
    "JWT_EXPIRE_MINUTES":"JWT token expiry in minutes",
}

SENSITIVE_KEYS = {"MINIO_SECRET_KEY", "POSTGRES_PASSWORD", "OPENAI_API_KEY", "JWT_SECRET"}


# ── Health ─────────────────────────────────────────────────────

@router.get("/health")
def admin_health(admin: dict = Depends(require_admin)):
    return {
        "api": "ok",
        "minio": storage.check_minio(),
        "qdrant": embedding.check_qdrant(),
        "ai": embedding.check_ai(),
    }


# ── Logs ───────────────────────────────────────────────────────

@router.get("/logs")
def get_logs(limit: int = 200, level: str = "", admin: dict = Depends(require_admin)):
    conn = database.get_conn()
    try:
        cur = conn.cursor()
        if level:
            cur.execute(
                "SELECT ts, level, logger, message FROM logs"
                " WHERE level = %s ORDER BY ts DESC LIMIT %s",
                (level.upper(), limit),
            )
        else:
            cur.execute(
                "SELECT ts, level, logger, message FROM logs ORDER BY ts DESC LIMIT %s",
                (limit,),
            )
        rows = cur.fetchall()
        return [{"ts": str(r[0]), "level": r[1], "logger": r[2], "message": r[3]} for r in rows]
    finally:
        cur.close()
        database.release_conn(conn)


@router.delete("/logs")
def clear_logs(admin: dict = Depends(require_admin)):
    conn = database.get_conn()
    try:
        cur = conn.cursor()
        cur.execute("TRUNCATE logs")
        conn.commit()
        logger.info("Logs cleared by %s", admin["sub"])
        return {"status": "cleared"}
    finally:
        cur.close()
        database.release_conn(conn)


# ── Config ─────────────────────────────────────────────────────

@router.get("/config")
def get_config(admin: dict = Depends(require_admin)):
    conn = database.get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT key, value, updated_at FROM app_config")
        db_map = {r[0]: {"value": r[1], "updated_at": str(r[2])} for r in cur.fetchall()}
    finally:
        cur.close()
        database.release_conn(conn)

    result = []
    for key, desc in CONFIGURABLE_KEYS.items():
        env_val = os.getenv(key, "")
        db_entry = db_map.get(key)
        sensitive = key in SENSITIVE_KEYS
        effective = db_entry["value"] if db_entry else env_val
        result.append({
            "key": key,
            "env_value":       "***" if sensitive else env_val,
            "db_value":        ("***" if sensitive else db_entry["value"]) if db_entry else None,
            "effective_value": "***" if sensitive else effective,
            "description":     desc,
            "sensitive":       sensitive,
            "has_db_override": db_entry is not None,
            "updated_at":      db_entry["updated_at"] if db_entry else None,
        })
    return result


class ConfigUpdate(BaseModel):
    value: str


@router.put("/config/{key}")
def set_config(key: str, body: ConfigUpdate, admin: dict = Depends(require_admin)):
    if key not in CONFIGURABLE_KEYS:
        raise HTTPException(status_code=400, detail=f"Key '{key}' is not configurable")
    conn = database.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO app_config (key, value, description, updated_at)
               VALUES (%s, %s, %s, NOW())
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()""",
            (key, body.value, CONFIGURABLE_KEYS[key]),
        )
        conn.commit()
        logger.info("Config updated: %s by %s", key, admin["sub"])
        return {"status": "updated", "key": key, "note": "Restart server to apply changes"}
    finally:
        cur.close()
        database.release_conn(conn)


@router.delete("/config/{key}")
def reset_config(key: str, admin: dict = Depends(require_admin)):
    conn = database.get_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM app_config WHERE key = %s", (key,))
        conn.commit()
        return {"status": "reset", "note": "Reverted to .env value"}
    finally:
        cur.close()
        database.release_conn(conn)
