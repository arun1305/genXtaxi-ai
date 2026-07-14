"""Driver heatmap + rider surge quote (spec §4.7). Consumed by Node via ai-gateway."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query

from app.auth import Principal, current_user, require_role
from app.config import get_settings
from app.db import get_db, get_redis
from app.geo.h3_utils import cell_to_boundary, cells_in_bbox
from app.predict.predictor import redis_key
from app.schemas import HeatmapCell, HeatmapResponse, SurgeResponse

router = APIRouter(prefix="/api/v1/demand", tags=["demand"])


def _next_window() -> datetime:
    s = get_settings()
    now = datetime.now(timezone.utc)
    discard = timedelta(minutes=now.minute % s.WINDOW_MINUTES, seconds=now.second, microseconds=now.microsecond)
    return now - discard + timedelta(minutes=s.WINDOW_MINUTES)


@router.get("/heatmap", response_model=HeatmapResponse, dependencies=[Depends(require_role("driver", "admin"))])
async def heatmap(
    city: str = "default",
    bbox: str = Query(..., description="min_lng,min_lat,max_lng,max_lat"),
):
    s = get_settings()
    r = get_redis()
    db = get_db()
    min_lng, min_lat, max_lng, max_lat = (float(x) for x in bbox.split(","))
    window = _next_window()
    cells = cells_in_bbox(min_lat, min_lng, max_lat, max_lng, s.H3_RESOLUTION)

    out: list[HeatmapCell] = []
    for hex_id in cells:
        raw = await r.get(redis_key(city, hex_id, window))
        predicted = json.loads(raw)["predicted"] if raw else 0.0
        state = await db.surge_state.find_one({"hexId": hex_id}, sort=[("createdAt", -1)])
        surge = state["multiplier"] if state else 1.0
        if predicted <= 0 and surge <= 1.0:
            continue  # keep the payload light — only interesting cells
        out.append(HeatmapCell(
            hex=hex_id, predicted=predicted, surge=surge,
            boundary=[[lat, lng] for lat, lng in cell_to_boundary(hex_id)],
        ))
    return HeatmapResponse(city=city, window=int(window.timestamp()), cells=out)


@router.get("/surge", response_model=SurgeResponse)
async def surge(hex: str, city: str = "default", user: Principal = Depends(current_user)):
    """Rider-facing advisory surge for a hex (multiplier only; currency applied by fare service)."""
    db = get_db()
    s = get_settings()
    state = await db.surge_state.find_one({"hexId": hex}, sort=[("createdAt", -1)])
    if not state:
        return SurgeResponse(hex=hex, multiplier=1.0, reason="no_data", advisory=s.SURGE_ADVISORY)
    return SurgeResponse(
        hex=hex, multiplier=state["multiplier"], reason=state.get("reason", "computed"),
        advisory=s.SURGE_ADVISORY,
    )
