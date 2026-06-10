import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from services.auth import get_current_user
from services.database import get_conn, release_conn

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/links", tags=["links"])


class LinkIn(BaseModel):
    name: str
    url: str
    env: Optional[str] = None
    tag: Optional[str] = None
    extra_fields: Optional[dict] = {}


# ── List ───────────────────────────────────────────────────────

@router.get("")
def list_links(user=Depends(get_current_user)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, name, url, env, tag, extra_fields, created_at
            FROM hyperlinks ORDER BY created_at DESC
        """)
        rows = cur.fetchall()
        return {"links": [
            {
                "id": r[0], "name": r[1], "url": r[2],
                "env": r[3], "tag": r[4],
                "extra_fields": r[5] or {},
                "created_at": r[6].isoformat() if r[6] else None,
            }
            for r in rows
        ]}
    finally:
        cur.close()
        release_conn(conn)


# ── Add ────────────────────────────────────────────────────────

@router.post("")
def add_link(body: LinkIn, user=Depends(get_current_user)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO hyperlinks (name, url, env, tag, extra_fields)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
        """, (body.name, body.url, body.env, body.tag, json.dumps(body.extra_fields or {})))
        new_id = cur.fetchone()[0]
        conn.commit()
        logger.info("Link added: id=%s name=%s by %s", new_id, body.name, user["sub"])
        return {"id": new_id, "message": "Link added"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        release_conn(conn)


# ── Delete ─────────────────────────────────────────────────────

@router.delete("/{link_id}")
def delete_link(link_id: int, user=Depends(get_current_user)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM hyperlinks WHERE id = %s RETURNING id", (link_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Link not found")
        conn.commit()
        logger.info("Link deleted: id=%s by %s", link_id, user["sub"])
        return {"message": "Link deleted"}
    finally:
        cur.close()
        release_conn(conn)
