import os
from dotenv import load_dotenv
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
load_dotenv()

MINIO_ENDPOINT   = os.getenv("MINIO_ENDPOINT", "")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "")
MINIO_BUCKET     = os.getenv("MINIO_BUCKET", "")
MINIO_SECURE     = os.getenv("MINIO_SECURE", "true").lower() == "true"

QDRANT_URL       = os.getenv("QDRANT_URL", "")
AI_BASE_URL      = os.getenv("AI_BASE_URL", "")
AI_API_KEY       = os.getenv("OPENAI_API_KEY", "")
EMBEDDING_MODEL  = os.getenv("EMBEDDING_MODEL", "")
CHAT_MODEL       = os.getenv("CHAT_MODEL", "kgpt-reasoning-text")
COLLECTION_NAME  = os.getenv("COLLECTION_NAME", "documents")

EMBEDDING_DIM    = 768
CHUNK_SIZE       = int(os.getenv("CHUNK_SIZE", 500))
CHUNK_OVERLAP    = int(os.getenv("CHUNK_OVERLAP", 50))
TOP_K            = 5

EMBEDDING_URL    = f"{AI_BASE_URL}/v1/embeddings"
CHAT_URL         = f"{AI_BASE_URL}/v1/chat/completions"
