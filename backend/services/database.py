import logging
import psycopg2
from psycopg2 import pool as pg_pool
from config import (
    POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER,
    POSTGRES_PASSWORD, POSTGRES_DB,
)

logger = logging.getLogger(__name__)
_pool: pg_pool.SimpleConnectionPool | None = None


def get_pool() -> pg_pool.SimpleConnectionPool:
    global _pool
    if _pool is None:
        _pool = pg_pool.SimpleConnectionPool(
            1, 10,
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
            dbname=POSTGRES_DB,
        )
    return _pool


def get_conn():
    return get_pool().getconn()


def release_conn(conn):
    get_pool().putconn(conn)


def init_db():
    from services.auth import hash_password
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'user',
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS logs (
                id SERIAL PRIMARY KEY,
                ts TIMESTAMP DEFAULT NOW(),
                level VARCHAR(10),
                logger VARCHAR(100),
                source VARCHAR(20) DEFAULT 'backend',
                message TEXT
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS logs_ts_idx ON logs (ts DESC)")
        # Migration: add source column to existing logs table
        cur.execute(
            "ALTER TABLE logs ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'backend'"
        )
        cur.execute("""
            CREATE TABLE IF NOT EXISTS app_config (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT,
                description TEXT,
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS file_uploads (
                id SERIAL PRIMARY KEY,
                object_name TEXT UNIQUE NOT NULL,
                uploaded_by VARCHAR(50) NOT NULL,
                uploaded_at TIMESTAMP DEFAULT NOW()
            )
        """)
        cur.execute(
            "CREATE INDEX IF NOT EXISTS file_uploads_obj_idx ON file_uploads (object_name)"
        )
        cur.execute("""
            CREATE TABLE IF NOT EXISTS monitored_systems (
                id SERIAL PRIMARY KEY,
                runner_tags TEXT NOT NULL,
                hostname VARCHAR(255),
                ip VARCHAR(50) NOT NULL,
                username VARCHAR(255) NOT NULL,
                encrypted_password TEXT NOT NULL,
                extra_fields JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS hyperlinks (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                url TEXT NOT NULL,
                env VARCHAR(100),
                tag VARCHAR(100),
                extra_fields JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        cur.execute("SELECT COUNT(*) FROM users")
        if cur.fetchone()[0] == 0:
            cur.execute(
                "INSERT INTO users (username, password_hash, role) VALUES (%s, %s, %s)",
                ("admin", hash_password("admin123"), "admin"),
            )
            cur.execute(
                "INSERT INTO users (username, password_hash, role) VALUES (%s, %s, %s)",
                ("user", hash_password("user123"), "user"),
            )
            logger.info("Seeded default users — admin/admin123 and user/user123")
        conn.commit()
        logger.info("Database ready")
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        release_conn(conn)
