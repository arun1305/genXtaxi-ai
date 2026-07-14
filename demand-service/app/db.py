"""Mongo (motor) + Redis clients. Collections match spec §4.6."""
from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import redis.asyncio as aioredis

from app.config import get_settings

_mongo_client: AsyncIOMotorClient | None = None
_redis: aioredis.Redis | None = None


def get_db() -> AsyncIOMotorDatabase:
    global _mongo_client
    settings = get_settings()
    if _mongo_client is None:
        _mongo_client = AsyncIOMotorClient(settings.MONGODB_URI)
    return _mongo_client[settings.MONGODB_DB]


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(get_settings().REDIS_URL, decode_responses=True)
    return _redis


async def ensure_indexes() -> None:
    """Indexes per spec §4.6 (idempotent)."""
    db = get_db()
    await db.demand_actuals.create_index([("hexId", 1), ("windowStart", -1)])
    await db.demand_predictions.create_index([("hexId", 1), ("windowStart", -1)])
    await db.surge_state.create_index([("hexId", 1), ("windowStart", -1)])
    await db.events.create_index([("location", "2dsphere")])
    await db.events.create_index([("hexId", 1), ("startAt", 1)])
    await db.model_registry.create_index([("city", 1), ("status", 1)])
