from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import services.embedding as embedding

router = APIRouter(prefix="/api")


class ChatRequest(BaseModel):
    question: str
    history: list = []


@router.post("/chat")
def chat(body: ChatRequest):
    try:
        if not body.question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty")

        vector  = embedding.get_single_embedding(body.question)
        results = embedding.search_qdrant(vector)

        if not results:
            return {"answer": "No documents found in the knowledge base. Please upload some documents first.",
                    "sources": [], "chunks_found": 0}

        answer = embedding.ask_ai(body.question, results, body.history)

        # Deduplicate by file, collect unique pages, keep best score
        seen_files: dict = {}
        for r in results:
            src  = r["payload"].get("source", "unknown")
            page = r["payload"].get("page")
            score = round(r["score"], 3)
            if src not in seen_files:
                seen_files[src] = {
                    "file": src,
                    "score": score,
                    "path": r["payload"].get("minio_path", src),
                    "pages": [page] if page else [],
                }
            else:
                if page and page not in seen_files[src]["pages"]:
                    seen_files[src]["pages"].append(page)

        sources = list(seen_files.values())
        return {"answer": answer, "sources": sources, "chunks_found": len(results)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
