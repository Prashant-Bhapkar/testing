"""
DocIQ — FastAPI backend
Run: uvicorn main:app --reload --port 8000
"""
import logging
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from routers import files, chat, health, auth, admin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("dociq")


class PgLogHandler(logging.Handler):
    """Writes log records to the PostgreSQL logs table (best-effort)."""

    def emit(self, record: logging.LogRecord):
        try:
            from services.database import get_pool
            p = get_pool()
            if p is None:
                return
            conn = p.getconn()
            try:
                cur = conn.cursor()
                cur.execute(
                    "INSERT INTO logs (level, logger, message) VALUES (%s, %s, %s)",
                    (record.levelname, record.name, self.format(record)[:2000]),
                )
                cur.execute("DELETE FROM logs WHERE ts < NOW() - INTERVAL '7 days'")
                conn.commit()
                cur.close()
            finally:
                p.putconn(conn)
        except Exception:
            pass  # Never let logging crash the app


app = FastAPI(title="DocIQ")


@app.on_event("startup")
def startup():
    from services.database import init_db
    try:
        init_db()
        pg_handler = PgLogHandler()
        pg_handler.setLevel(logging.INFO)
        pg_handler.setFormatter(logging.Formatter("%(message)s"))
        logging.getLogger().addHandler(pg_handler)
        logger.info("DB log handler attached")
    except Exception as e:
        logger.warning("Database unavailable — auth and log features disabled: %s", e)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    ms = round((time.perf_counter() - start) * 1000)
    logger.info("%s %s → %d [%dms]", request.method, request.url.path, response.status_code, ms)
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files.router)
app.include_router(chat.router)
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(admin.router)
