import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.auth import (
    authenticate_user, create_token, hash_password,
    verify_password, get_current_user, require_admin,
)
from services import database

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth")


class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "user"


@router.post("/login")
def login(body: LoginRequest):
    user = authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["username"], user["role"])
    logger.info("Login: %s (%s)", user["username"], user["role"])
    return {"token": token, "username": user["username"], "role": user["role"]}


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return {"username": user["sub"], "role": user["role"]}


@router.post("/change-password")
def change_password(body: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    conn = database.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT password_hash FROM users WHERE username = %s", (user["sub"],)
        )
        row = cur.fetchone()
        if not row or not verify_password(body.old_password, row[0]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        cur.execute(
            "UPDATE users SET password_hash = %s WHERE username = %s",
            (hash_password(body.new_password), user["sub"]),
        )
        conn.commit()
        logger.info("Password changed: %s", user["sub"])
        return {"status": "ok"}
    finally:
        cur.close()
        database.release_conn(conn)


@router.get("/users")
def list_users(admin: dict = Depends(require_admin)):
    conn = database.get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT username, role, created_at FROM users ORDER BY created_at")
        rows = cur.fetchall()
        return [{"username": r[0], "role": r[1], "created_at": str(r[2])} for r in rows]
    finally:
        cur.close()
        database.release_conn(conn)


@router.post("/users")
def create_user(body: CreateUserRequest, admin: dict = Depends(require_admin)):
    if body.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'")
    conn = database.get_conn()
    try:
        cur = conn.cursor()
        try:
            cur.execute(
                "INSERT INTO users (username, password_hash, role) VALUES (%s, %s, %s)",
                (body.username, hash_password(body.password), body.role),
            )
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=400, detail=f"Could not create user: {e}")
        logger.info("User created: %s (%s) by %s", body.username, body.role, admin["sub"])
        return {"status": "created", "username": body.username}
    finally:
        cur.close()
        database.release_conn(conn)


@router.delete("/users/{username}")
def delete_user(username: str, admin: dict = Depends(require_admin)):
    if username == admin["sub"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    conn = database.get_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM users WHERE username = %s", (username,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")
        conn.commit()
        logger.info("User deleted: %s by %s", username, admin["sub"])
        return {"status": "deleted"}
    finally:
        cur.close()
        database.release_conn(conn)
