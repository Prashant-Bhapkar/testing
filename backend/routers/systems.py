import asyncio
import fcntl
import json
import logging
import os
import pty
import struct
import termios
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from pydantic import BaseModel

from config import JWT_SECRET, JWT_ALGORITHM
from services.auth import get_current_user, require_admin
from services.database import get_conn, release_conn
from services.ssh_checker import encrypt_password, ping_host, check_runner_status, restart_runner, open_ssh_terminal, decrypt_password

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/systems", tags=["systems"])


class SystemIn(BaseModel):
    runner_tags: str
    hostname: Optional[str] = None
    ip: str
    username: str
    password: str
    extra_fields: Optional[dict] = {}


class SystemUpdate(BaseModel):
    runner_tags: str
    hostname: Optional[str] = None
    ip: str
    username: str
    password: Optional[str] = None   # blank = keep existing password
    extra_fields: Optional[dict] = {}


# ── List ───────────────────────────────────────────────────────

@router.get("")
def list_systems(user=Depends(require_admin)):
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


# ── Update ─────────────────────────────────────────────────────

@router.put("/{system_id}")
def update_system(system_id: int, body: SystemUpdate, user=Depends(require_admin)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        if body.password:
            cur.execute("""
                UPDATE monitored_systems
                SET runner_tags=%s, hostname=%s, ip=%s, username=%s,
                    encrypted_password=%s, extra_fields=%s
                WHERE id=%s RETURNING id
            """, (
                body.runner_tags, body.hostname, body.ip, body.username,
                encrypt_password(body.password),
                json.dumps(body.extra_fields or {}), system_id,
            ))
        else:
            cur.execute("""
                UPDATE monitored_systems
                SET runner_tags=%s, hostname=%s, ip=%s, username=%s, extra_fields=%s
                WHERE id=%s RETURNING id
            """, (
                body.runner_tags, body.hostname, body.ip, body.username,
                json.dumps(body.extra_fields or {}), system_id,
            ))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="System not found")
        conn.commit()
        logger.info("System updated: id=%s by %s", system_id, user["sub"])
        return {"message": "System updated"}
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
def check_system(system_id: int, user=Depends(require_admin)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT ip, username, encrypted_password, hostname FROM monitored_systems WHERE id = %s",
            (system_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="System not found")
        ip, username, encrypted_password, hostname = row
    finally:
        cur.close()
        release_conn(conn)

    ping_ok = ping_host(ip, hostname=hostname)
    runner = check_runner_status(ip, username, encrypted_password, hostname=hostname)
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
            "SELECT ip, username, encrypted_password, hostname FROM monitored_systems WHERE id = %s",
            (system_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="System not found")
        ip, username, encrypted_password, hostname = row
    finally:
        cur.close()
        release_conn(conn)

    logger.info("Restarting runner on %s, requested by %s", ip, user["sub"])
    result = restart_runner(ip, username, encrypted_password, hostname=hostname)
    return result


# ── Open SSH terminal ──────────────────────────────────────────

@router.post("/{system_id}/terminal")
def open_terminal(system_id: int, user=Depends(require_admin)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT ip, username, encrypted_password, hostname FROM monitored_systems WHERE id = %s",
            (system_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="System not found")
        ip, username, encrypted_password, hostname = row
    finally:
        cur.close()
        release_conn(conn)

    return open_ssh_terminal(ip, username, encrypted_password, hostname=hostname)


# ── Web terminal (WebSocket + PTY) ─────────────────────────────

@router.websocket("/{system_id}/ws-terminal")
async def ws_terminal(websocket: WebSocket, system_id: int, token: str = Query("")):
    # Authenticate via query-param token (headers not available in WS)
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        await websocket.close(code=4401)
        return

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT ip, username, encrypted_password, hostname FROM monitored_systems WHERE id = %s",
            (system_id,),
        )
        row = cur.fetchone()
        if not row:
            await websocket.close(code=4404)
            return
        ip, username, encrypted_password, hostname = row
    finally:
        cur.close()
        release_conn(conn)

    target = hostname or ip
    password = decrypt_password(encrypted_password)

    await websocket.accept()

    # Create a PTY pair and spawn SSH through it
    master_fd, slave_fd = pty.openpty()
    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, struct.pack("HHHH", 24, 80, 0, 0))

    env = {**os.environ, "SSHPASS": password}
    process = await asyncio.create_subprocess_exec(
        "sshpass", "-e", "ssh",
        "-o", "StrictHostKeyChecking=no",
        "-o", "UserKnownHostsFile=/dev/null",
        f"{username}@{target}",
        stdin=slave_fd, stdout=slave_fd, stderr=slave_fd,
        env=env,
    )
    os.close(slave_fd)

    loop = asyncio.get_event_loop()

    async def pty_to_ws():
        """Read from PTY and send to browser."""
        while True:
            try:
                data = await loop.run_in_executor(None, lambda: os.read(master_fd, 4096))
                await websocket.send_bytes(data)
            except (OSError, RuntimeError):
                break

    async def ws_to_pty():
        """Receive from browser and write to PTY."""
        while True:
            try:
                msg = await websocket.receive()
                if msg["type"] == "websocket.disconnect":
                    break
                if msg.get("bytes"):
                    os.write(master_fd, msg["bytes"])
                elif msg.get("text"):
                    try:
                        data = json.loads(msg["text"])
                        if data.get("type") == "resize":
                            fcntl.ioctl(
                                master_fd, termios.TIOCSWINSZ,
                                struct.pack("HHHH", data["rows"], data["cols"], 0, 0),
                            )
                    except (json.JSONDecodeError, KeyError):
                        os.write(master_fd, msg["text"].encode())
            except (WebSocketDisconnect, RuntimeError):
                break

    try:
        await asyncio.gather(pty_to_ws(), ws_to_pty())
    finally:
        try:
            process.terminate()
        except Exception:
            pass
        try:
            os.close(master_fd)
        except OSError:
            pass
