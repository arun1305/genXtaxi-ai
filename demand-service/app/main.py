"""
demand-service FastAPI app (spec §4). Assembles routers, starts the batch
scheduler, and ensures indexes. Surge is ADVISORY this phase (does not change
live fares).
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import ensure_indexes
from app.routers import admin, demand, health, ws
from app.scheduler import build_scheduler

_scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler
    try:
        await ensure_indexes()
    except Exception:
        pass  # dev without Mongo still serves /health
    _scheduler = build_scheduler()
    _scheduler.start()
    yield
    if _scheduler:
        _scheduler.shutdown(wait=False)


app = FastAPI(
    title="GenXTaxi demand-service",
    description="Demand prediction + advisory surge over H3 hexes (spec §4).",
    version="1.0",
    lifespan=lifespan,
)

# CORS — the admin panel (browser) calls this service cross-origin. The NestJS
# AI services use enableCors({ origin: true }); mirror that here so the admin
# "AI ops / surge" pages aren't blocked by the browser's CORS preflight.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(demand.router)
app.include_router(admin.router)
app.include_router(ws.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=get_settings().PORT, reload=False)
