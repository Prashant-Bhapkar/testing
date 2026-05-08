"""
DocIQ — FastAPI backend
Run: uvicorn main:app --reload --port 8000
"""
import logging
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from routers import files, chat, health

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("dociq")

app = FastAPI(title="DocIQ")


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
