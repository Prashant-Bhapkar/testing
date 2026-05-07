import uuid
import requests
import fitz  # PyMuPDF
from pathlib import Path
from io import BytesIO
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from config import (
    QDRANT_URL, AI_API_KEY, EMBEDDING_MODEL, EMBEDDING_URL,
    COLLECTION_NAME, EMBEDDING_DIM, CHUNK_SIZE, CHUNK_OVERLAP,
    CHAT_URL, CHAT_MODEL, TOP_K,
)

EMBEDDABLE_EXTENSIONS = {"pdf", "txt", "md", "csv", "docx"}


# ── Qdrant client ──────────────────────────────────────────────

def get_qdrant() -> QdrantClient:
    return QdrantClient(url=QDRANT_URL, port=80, https=False, verify=False)


def ensure_collection(client: QdrantClient):
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in existing:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
        )


# ── Text helpers ───────────────────────────────────────────────

def clean_text(text: str) -> str:
    text = text.replace("\x00", "")
    text = " ".join(text.split())
    return text.encode("utf-8", errors="ignore").decode("utf-8").strip()


def chunk_text(text: str) -> list:
    """Paragraph-aware chunking; falls back to character split for very long paragraphs."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks, current = [], ""

    for para in paragraphs:
        if len(current) + len(para) < CHUNK_SIZE:
            current = (current + "\n\n" + para).strip() if current else para
        else:
            if current:
                chunks.append(current)
            current = para

    if current.strip():
        chunks.append(current.strip())

    # Fallback: hard-split any chunk that is still too long
    result = []
    for chunk in chunks:
        if len(chunk) > CHUNK_SIZE * 2:
            start = 0
            while start < len(chunk):
                result.append(chunk[start:start + CHUNK_SIZE].strip())
                start += CHUNK_SIZE - CHUNK_OVERLAP
        else:
            result.append(chunk)

    return [c for c in result if len(c) > 30]


def extract_text(file_bytes: bytes, ext: str) -> list:
    """Returns list of (page_num, text) tuples."""
    if ext == "pdf":
        return _extract_pdf_pages(file_bytes)
    elif ext == "docx":
        return [(1, _extract_docx_text(file_bytes))]
    else:  # txt, md, csv
        return [(1, file_bytes.decode("utf-8", errors="ignore"))]


def _extract_pdf_pages(pdf_bytes: bytes) -> list:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page_num, page in enumerate(doc, 1):
        text = page.get_text()
        if text.strip():
            pages.append((page_num, text))
    doc.close()
    return pages


def _extract_docx_text(docx_bytes: bytes) -> str:
    try:
        import docx as python_docx
        doc = python_docx.Document(BytesIO(docx_bytes))
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except ImportError:
        return ""


# Backward-compat shim used by old code paths
def extract_text_from_bytes(pdf_bytes: bytes) -> str:
    return "\n".join(f"\n[Page {p}]\n{t}" for p, t in _extract_pdf_pages(pdf_bytes))


# ── Embedding API ──────────────────────────────────────────────

def get_single_embedding(text: str) -> list:
    text = clean_text(text)
    if not text:
        return [0.0] * EMBEDDING_DIM
    r = requests.post(
        EMBEDDING_URL,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {AI_API_KEY}"},
        json={"input": text, "model": EMBEDDING_MODEL, "encoding_format": "float"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["data"][0]["embedding"]


# ── Qdrant ops ─────────────────────────────────────────────────

def count_embeddings_for_file(filename: str) -> int:
    try:
        r = requests.post(
            f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points/count",
            headers={"Content-Type": "application/json"},
            json={"filter": {"must": [{"key": "source", "match": {"value": filename}}]}},
            verify=False, timeout=10,
        )
        return r.json().get("result", {}).get("count", 0)
    except Exception:
        return 0


def delete_embeddings_for_file(filename: str):
    try:
        requests.post(
            f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points/delete",
            headers={"Content-Type": "application/json"},
            json={"filter": {"must": [{"key": "source", "match": {"value": filename}}]}},
            verify=False, timeout=15,
        )
    except Exception as e:
        print(f"Could not delete embeddings for '{filename}': {e}")


def embed_document(file_bytes: bytes, object_name: str) -> dict:
    filename = Path(object_name).name
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    existing = count_embeddings_for_file(filename)
    if existing > 0:
        delete_embeddings_for_file(filename)

    pages = extract_text(file_bytes, ext)

    points = []
    chunk_index = 0
    for page_num, page_text in pages:
        page_text = clean_text(page_text)
        if not page_text:
            continue
        for chunk in chunk_text(page_text):
            emb = get_single_embedding(chunk)
            points.append(PointStruct(
                id=str(uuid.uuid4()),
                vector=emb,
                payload={
                    "text": chunk,
                    "source": filename,
                    "minio_path": object_name,
                    "chunk_index": chunk_index,
                    "page": page_num,
                },
            ))
            chunk_index += 1

    if not points:
        return {"status": "skipped", "reason": "No text extracted"}

    qdrant = get_qdrant()
    ensure_collection(qdrant)
    qdrant.upsert(collection_name=COLLECTION_NAME, points=points)
    return {"status": "embedded", "filename": filename,
            "chunks": len(points), "replaced_old": existing > 0}


# Backward-compatible alias
def embed_pdf(pdf_bytes: bytes, object_name: str) -> dict:
    return embed_document(pdf_bytes, object_name)


# ── Health checks ──────────────────────────────────────────────

def check_qdrant() -> str:
    try:
        get_qdrant().get_collections()
        return "ok"
    except Exception as e:
        return f"error: {str(e)[:120]}"


def check_ai() -> str:
    try:
        emb = get_single_embedding("health check")
        return "ok" if len(emb) > 0 else "error: empty embedding"
    except Exception as e:
        return f"error: {str(e)[:120]}"


# ── Search + Chat ──────────────────────────────────────────────

def search_qdrant(vector: list) -> list:
    r = requests.post(
        f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points/search",
        headers={"Content-Type": "application/json"},
        json={"vector": vector, "limit": TOP_K, "with_payload": True},
        verify=False, timeout=15,
    )
    r.raise_for_status()
    return r.json().get("result", [])


def ask_ai(question: str, chunks: list, history: list) -> str:
    context = "\n\n---\n\n".join(
        f"[Source: {c['payload']['source']} | Page: {c['payload'].get('page', '?')} | "
        f"Chunk {c['payload'].get('chunk_index', 0)} | Score: {round(c['score'], 3)}]\n{c['payload']['text']}"
        for c in chunks
    )
    system_prompt = (
        "You are a helpful assistant that answers questions based on the provided document context.\n"
        "Rules:\n"
        "- Answer ONLY from the context provided below\n"
        "- If the answer is not in the context, say \"I could not find this in the uploaded documents\"\n"
        "- Be concise and clear\n"
        "- Always mention which document/source your answer comes from\n"
        "- If multiple documents are relevant, mention all of them"
    )
    messages = [{"role": "system", "content": system_prompt}]
    for h in history[-6:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": f"Context from documents:\n{context}\n\nQuestion: {question}"})

    r = requests.post(
        CHAT_URL,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {AI_API_KEY}"},
        json={"model": CHAT_MODEL, "messages": messages, "temperature": 0.2},
        timeout=60,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]
