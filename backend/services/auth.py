import logging
import bcrypt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_MINUTES

logger = logging.getLogger(__name__)
bearer = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_token(username: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": username, "role": role, "exp": expire},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    return _decode(creds.credentials)


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


def authenticate_user(username: str, password: str) -> dict | None:
    from services import database
    conn = database.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT username, password_hash, role FROM users WHERE username = %s",
            (username,),
        )
        row = cur.fetchone()
        if not row or not verify_password(password, row[1]):
            return None
        return {"username": row[0], "role": row[2]}
    finally:
        cur.close()
        database.release_conn(conn)
