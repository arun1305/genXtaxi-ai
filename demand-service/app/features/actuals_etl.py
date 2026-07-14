"""
ETL: aggregate the shared `rides` collection into demand_actuals per hex per
15-min window (spec §4.6). Trains on REQUESTS including unmet (status
'no_driver' / cancelled) — not just completed — to avoid the surge feedback
loop (spec §4.8). Watermark-driven + incremental, like the review ingest.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.config import get_settings
from app.db import get_db
from app.geo.h3_utils import latlng_to_cell


def _floor_window(dt: datetime, minutes: int) -> datetime:
    discard = timedelta(
        minutes=dt.minute % minutes, seconds=dt.second, microseconds=dt.microsecond
    )
    return dt - discard


async def run_actuals_etl(limit: int = 5000) -> int:
    """Fold new rides into demand_actuals. Returns rides processed."""
    settings = get_settings()
    db = get_db()

    wm_doc = await db.demand_watermarks.find_one({"source": "rides"})
    since = wm_doc["lastCreatedAt"] if wm_doc else datetime(1970, 1, 1, tzinfo=timezone.utc)

    cursor = (
        db.rides.find(
            {"createdAt": {"$gt": since}, "pickup.location.coordinates": {"$exists": True}},
            {"createdAt": 1, "status": 1, "pickup.location.coordinates": 1, "completedAt": 1},
        )
        .sort("createdAt", 1)
        .limit(limit)
    )

    buckets: dict[tuple[str, datetime], dict] = {}
    new_watermark = since
    processed = 0

    async for ride in cursor:
        coords = (((ride.get("pickup") or {}).get("location") or {}).get("coordinates"))
        created = ride.get("createdAt")
        if not coords or len(coords) != 2 or not created:
            continue
        lng, lat = coords[0], coords[1]
        hex_id = latlng_to_cell(lat, lng, settings.H3_RESOLUTION)
        window = _floor_window(created, settings.WINDOW_MINUTES)
        key = (hex_id, window)
        b = buckets.setdefault(key, {"rideRequests": 0, "completed": 0, "cancelled": 0})
        b["rideRequests"] += 1
        status = ride.get("status")
        if status == "completed":
            b["completed"] += 1
        elif status in ("cancelled", "no_driver"):
            b["cancelled"] += 1
        if created > new_watermark:
            new_watermark = created
        processed += 1

    for (hex_id, window), b in buckets.items():
        await db.demand_actuals.update_one(
            {"hexId": hex_id, "windowStart": window},
            {"$inc": b},
            upsert=True,
        )

    if processed:
        await db.demand_watermarks.update_one(
            {"source": "rides"},
            {"$set": {"lastCreatedAt": new_watermark}},
            upsert=True,
        )
    return processed
