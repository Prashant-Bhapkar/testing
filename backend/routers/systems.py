import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from services.auth import get_current_user, require_admin
from services.database import get_conn, release_conn
from services.ssh_checker import encrypt_password, ping_host, check_runner_status, restart_runner

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/systems", tags=["systems"])


class SystemIn(BaseModel):
    runner_tags: str
    hostname: Optional[str] = None
    ip: str
    username: str
    password: str
    extra_fields: Optional[dict] = {}


# ── List ───────────────────────────────────────────────────────

@router.get("")
def list_systems(user=Depends(get_current_user)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, runner_tags, hostname, ip, username, extra_fields, created_at
            FROM monitored_systems ORDER BY created_at DESC
        """)
        rows = cur.fetchall()
        return {"systems": [
            {
                "id": r[0], "runner_tags": r[1], "hostname": r[2],
                "ip": r[3], "username": r[4],
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
def add_system(body: SystemIn, user=Depends(require_admin)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO monitored_systems (runner_tags, hostname, ip, username, encrypted_password, extra_fields)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
        """, (
            body.runner_tags, body.hostname, body.ip,
            body.username, encrypt_password(body.password),
            json.dumps(body.extra_fields or {}),
        ))
        new_id = cur.fetchone()[0]
        conn.commit()
        logger.info("System added: id=%s ip=%s tags=%s by %s", new_id, body.ip, body.runner_tags, user["sub"])
        return {"id": new_id, "message": "System added"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        release_conn(conn)


# ── Delete ─────────────────────────────────────────────────────

@router.delete("/{system_id}")
def delete_system(system_id: int, user=Depends(require_admin)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM monitored_systems WHERE id = %s RETURNING id", (system_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="System not found")
        conn.commit()
        logger.info("System deleted: id=%s by %s", system_id, user["sub"])
        return {"message": "System deleted"}
    finally:
        cur.close()
        release_conn(conn)


# ── Check status ───────────────────────────────────────────────

@router.get("/{system_id}/check")
def check_system(system_id: int, user=Depends(get_current_user)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT ip, username, encrypted_password FROM monitored_systems WHERE id = %s",
            (system_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="System not found")
        ip, username, encrypted_password = row
    finally:
        cur.close()
        release_conn(conn)

    ping_ok = ping_host(ip)
    runner = check_runner_status(ip, username, encrypted_password)
    return {
        "ping": ping_ok,
        "runner_connected": runner["connected"],
        "runner_running": runner["running"],
        "runner_output": runner["output"],
    }


# ── Restart runner ─────────────────────────────────────────────

@router.post("/{system_id}/restart")
def restart_system_runner(system_id: int, user=Depends(require_admin)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT ip, username, encrypted_password FROM monitored_systems WHERE id = %s",
            (system_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="System not found")
        ip, username, encrypted_password = row
    finally:
        cur.close()
        release_conn(conn)

    logger.info("Restarting runner on %s, requested by %s", ip, user["sub"])
    result = restart_runner(ip, username, encrypted_password)
    return result
