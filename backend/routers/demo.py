import re
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from config import EMBEDDING_DIM
from services.auth import get_current_user, require_admin
from services.database import get_conn, release_conn
from services.embedding import get_single_embedding, get_qdrant
from qdrant_client.models import Distance, VectorParams, PointStruct, PointIdsList

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/demo", tags=["demo"])

DEMO_COLLECTION = "demo_feedback"


def _ensure_collection():
    try:
        client = get_qdrant()
        existing = [c.name for c in client.get_collections().collections]
        if DEMO_COLLECTION not in existing:
            client.create_collection(
                collection_name=DEMO_COLLECTION,
                vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
            )
    except Exception as e:
        logger.warning("Could not ensure %s Qdrant collection: %s", DEMO_COLLECTION, e)


def _strip_html(html: str) -> str:
    return re.sub(r'<[^>]+>', ' ', html or '').strip()


def _embed_text(data: dict) -> str:
    parts = [
        f"Customer: {data.get('customer_name', '')}",
        f"Showcased: {_strip_html(data.get('what_showcased', ''))}",
        f"Customer inputs: {data.get('customer_inputs', '') or ''}",
        f"Improvement suggestions: {data.get('improvement_suggestions', '') or ''}",
        f"Other suggestions: {data.get('other_suggestions', '') or ''}",
    ]
    return "\n".join(p for p in parts if p.split(': ', 1)[1].strip())


def _upsert_qdrant(demo_id: int, data: dict):
    try:
        _ensure_collection()
        text = _embed_text(data)
        if not text.strip():
            return
        vector = get_single_embedding(text)
        client = get_qdrant()
        client.upsert(
            collection_name=DEMO_COLLECTION,
            points=[PointStruct(
                id=demo_id,
                vector=vector,
                payload={
                    "demo_id": demo_id,
                    "customer_name": data.get("customer_name"),
                    "demo_start_date": str(data.get("demo_start_date", "")),
                    "demo_end_date": str(data.get("demo_end_date", "")),
                    "given_by": data.get("given_by"),
                    "developer_support": data.get("developer_support"),
                    "confidence_rating": data.get("confidence_rating"),
                    "text_preview": text[:400],
                },
            )],
        )
        logger.info("Demo %d embedded into Qdrant collection %s", demo_id, DEMO_COLLECTION)
    except Exception as e:
        logger.warning("Could not embed demo %d to Qdrant: %s", demo_id, e)


class DemoIn(BaseModel):
    customer_name: str
    demo_start_date: date
    demo_end_date: date
    given_by: str
    developer_support: Optional[str] = None
    what_showcased: Optional[str] = None
    customer_inputs: Optional[str] = None
    improvement_suggestions: Optional[str] = None
    other_suggestions: Optional[str] = None
    confidence_rating: Optional[int] = None


def _row(r) -> dict:
    return {
        "id": r[0],
        "customer_name": r[1],
        "demo_start_date": r[2].isoformat() if r[2] else None,
        "demo_end_date": r[3].isoformat() if r[3] else None,
        "given_by": r[4],
        "developer_support": r[5],
        "what_showcased": r[6],
        "customer_inputs": r[7],
        "improvement_suggestions": r[8],
        "other_suggestions": r[9],
        "confidence_rating": r[10],
        "created_at": r[11].isoformat() if r[11] else None,
        "updated_at": r[12].isoformat() if r[12] else None,
    }


# ── List ───────────────────────────────────────────────────────

@router.get("")
def list_demos(
    customer: Optional[str] = Query(None),
    month: Optional[str] = Query(None),   # YYYY-MM
    user=Depends(get_current_user),
):
    conn = get_conn()
    try:
        cur = conn.cursor()
        where, params = [], []
        if customer:
            where.append("LOWER(customer_name) = LOWER(%s)")
            params.append(customer)
        if month:
            try:
                y, m = month.split("-")
                where.append(
                    "EXTRACT(YEAR FROM demo_start_date) = %s "
                    "AND EXTRACT(MONTH FROM demo_start_date) = %s"
                )
                params.extend([int(y), int(m)])
            except ValueError:
                pass
        sql = """
            SELECT id, customer_name, demo_start_date, demo_end_date,
                   given_by, developer_support, what_showcased, customer_inputs,
                   improvement_suggestions, other_suggestions, confidence_rating,
                   created_at, updated_at
            FROM demo_feedback
        """
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY demo_start_date DESC"
        cur.execute(sql, params)
        return {"demos": [_row(r) for r in cur.fetchall()]}
    finally:
        cur.close()
        release_conn(conn)


# ── Customers (for filter dropdown) ────────────────────────────

@router.get("/customers")
def list_customers(user=Depends(get_current_user)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT DISTINCT customer_name FROM demo_feedback ORDER BY customer_name"
        )
        return {"customers": [r[0] for r in cur.fetchall()]}
    finally:
        cur.close()
        release_conn(conn)


# ── Create ─────────────────────────────────────────────────────

@router.post("")
def create_demo(body: DemoIn, user=Depends(get_current_user)):
    conn = get_conn()
    cur = None
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO demo_feedback (
                customer_name, demo_start_date, demo_end_date, given_by,
                developer_support, what_showcased, customer_inputs,
                improvement_suggestions, other_suggestions, confidence_rating
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        """, (
            body.customer_name, body.demo_start_date, body.demo_end_date, body.given_by,
            body.developer_support, body.what_showcased, body.customer_inputs,
            body.improvement_suggestions, body.other_suggestions, body.confidence_rating,
        ))
        new_id = cur.fetchone()[0]
        conn.commit()
        logger.info("Demo created: id=%d customer=%s by %s", new_id, body.customer_name, user["sub"])
        _upsert_qdrant(new_id, body.model_dump())
        return {"id": new_id, "message": "Demo feedback saved"}
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                pass
        release_conn(conn)


# ── Update ─────────────────────────────────────────────────────

@router.put("/{demo_id}")
def update_demo(demo_id: int, body: DemoIn, user=Depends(get_current_user)):
    conn = get_conn()
    cur = None
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE demo_feedback SET
                customer_name=%s, demo_start_date=%s, demo_end_date=%s, given_by=%s,
                developer_support=%s, what_showcased=%s, customer_inputs=%s,
                improvement_suggestions=%s, other_suggestions=%s,
                confidence_rating=%s, updated_at=NOW()
            WHERE id=%s RETURNING id
        """, (
            body.customer_name, body.demo_start_date, body.demo_end_date, body.given_by,
            body.developer_support, body.what_showcased, body.customer_inputs,
            body.improvement_suggestions, body.other_suggestions, body.confidence_rating,
            demo_id,
        ))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Demo not found")
        conn.commit()
        logger.info("Demo updated: id=%d by %s", demo_id, user["sub"])
        _upsert_qdrant(demo_id, body.model_dump())
        return {"message": "Demo feedback updated"}
    except HTTPException:
        raise
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                pass
        release_conn(conn)


# ── Delete ─────────────────────────────────────────────────────

@router.delete("/{demo_id}")
def delete_demo(demo_id: int, user=Depends(get_current_user)):
    conn = get_conn()
    cur = None
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM demo_feedback WHERE id=%s RETURNING id", (demo_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Demo not found")
        conn.commit()
        logger.info("Demo deleted: id=%d by %s", demo_id, user["sub"])
        try:
            get_qdrant().delete(
                collection_name=DEMO_COLLECTION,
                points_selector=PointIdsList(points=[demo_id]),
            )
        except Exception as e:
            logger.warning("Could not delete demo %d from Qdrant: %s", demo_id, e)
        return {"message": "Demo feedback deleted"}
    except HTTPException:
        raise
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                pass
        release_conn(conn)
