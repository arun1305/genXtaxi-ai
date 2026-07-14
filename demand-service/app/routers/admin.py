"""Admin surge controls + events + model health (spec §4.7)."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.auth import require_role
from app.db import get_db
from app.geo.h3_utils import latlng_to_cell
from app.config import get_settings
from app.models.baseline import mape
from app.schemas import EventRequest, ModelHealth, OverrideRequest
from app.surge.surge_service import SurgeService

router = APIRouter(prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(require_role("admin"))])


@router.post("/surge/override")
async def surge_override(body: OverrideRequest):
    """Per-zone override or kill-switch (multiplier=null). Takes effect within one cycle (< 5s target)."""
    await SurgeService().set_override(body.hex, body.multiplier, body.ttl)
    return {"ok": True, "hex": body.hex, "multiplier": body.multiplier}


@router.post("/events")
async def register_event(body: EventRequest):
    """Register an event signal that feeds the model (spec §4.5 event calendar)."""
    db = get_db()
    s = get_settings()
    hex_id = latlng_to_cell(body.lat, body.lng, s.H3_RESOLUTION)
    doc = {
        "name": body.name, "hexId": hex_id,
        "startAt": datetime.fromisoformat(body.startAt),
        "endAt": datetime.fromisoformat(body.endAt),
        "expectedAttendance": body.expectedAttendance, "source": body.source,
        "location": {"type": "Point", "coordinates": [body.lng, body.lat]},
    }
    res = await db.events.insert_one(doc)
    return {"eventId": str(res.inserted_id), "hexId": hex_id}


@router.get("/demand/model-health", response_model=ModelHealth)
async def model_health(city: str = "default"):
    db = get_db()
    active = await db.model_registry.find_one({"city": city, "status": "active"})

    # Live drift proxy: recent predicted vs actual MAPE.
    actuals, preds = [], []
    async for a in db.demand_actuals.find().sort("windowStart", -1).limit(500):
        p = await db.demand_predictions.find_one({"hexId": a["hexId"], "windowStart": a["windowStart"]})
        if p:
            actuals.append(float(a.get("rideRequests", 0)))
            preds.append(float(p.get("predicted", 0)))
    live_mape = mape(actuals, preds) if actuals else None

    active_mape = active["metrics"].get("mape") if active else None
    baseline_mape = active["metrics"].get("baselineMape") if active else None
    beats = None
    if active_mape and baseline_mape:
        beats = round((baseline_mape - active_mape) / baseline_mape * 100, 1)

    return ModelHealth(
        city=city,
        activeVersion=active["version"] if active else None,
        activeMape=active_mape,
        baselineMape=baseline_mape,
        beatsBaselinePct=beats,
        drift=round(live_mape, 3) if live_mape is not None else None,
        lastTrainedAt=active["trainedAt"].isoformat() if active else None,
    )
