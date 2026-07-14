from fastapi import APIRouter

from app.db import get_db, get_redis

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    mongo_ok = redis_ok = False
    try:
        await get_db().command("ping")
        mongo_ok = True
    except Exception:
        pass
    try:
        redis_ok = await get_redis().ping()
    except Exception:
        pass
    return {
        "status": "ok" if mongo_ok and redis_ok else "degraded",
        "service": "demand-service",
        "dependencies": {"mongodb": mongo_ok, "redis": redis_ok},
    }
