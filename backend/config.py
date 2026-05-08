import os
from dotenv import load_dotenv
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
load_dotenv()

# ── MinIO ──────────────────────────────────────────────────────
MINIO_ENDPOINT   = os.getenv("MINIO_ENDPOINT", "")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "")
MINIO_BUCKET     = os.getenv("MINIO_BUCKET", "")
MINIO_SECURE     = os.getenv("MINIO_SECURE", "true").lower() == "true"

# ── Qdrant ─────────────────────────────────────────────────────
QDRANT_URL       = os.getenv("QDRANT_URL", "")

# ── AI / LLM ───────────────────────────────────────────────────
AI_BASE_URL      = os.getenv("AI_BASE_URL", "")
AI_API_KEY       = os.getenv("OPENAI_API_KEY", "")
EMBEDDING_MODEL  = os.getenv("EMBEDDING_MODEL", "")
CHAT_MODEL       = os.getenv("CHAT_MODEL", "")
COLLECTION_NAME  = os.getenv("COLLECTION_NAME", "documents")

EMBEDDING_DIM    = 768
CHUNK_SIZE       = int(os.getenv("CHUNK_SIZE", "500"))
CHUNK_OVERLAP    = int(os.getenv("CHUNK_OVERLAP", "50"))
TOP_K            = 5

EMBEDDING_URL    = f"{AI_BASE_URL}/v1/embeddings"
CHAT_URL         = f"{AI_BASE_URL}/v1/chat/completions"

# ── PostgreSQL ─────────────────────────────────────────────────
POSTGRES_HOST     = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT     = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_USER     = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")
POSTGRES_DB       = os.getenv("POSTGRES_DB", "dociq")

# ── JWT Auth ───────────────────────────────────────────────────
JWT_SECRET         = os.getenv("JWT_SECRET", "change-this-secret")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))
JWT_ALGORITHM      = "HS256"
