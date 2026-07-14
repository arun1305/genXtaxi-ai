"""
Training job (spec §4.3): build the supervised frame from demand_actuals,
train a LightGBM shadow model, evaluate vs the seasonal baseline on a holdout,
register as shadow, and promote only if it beats the active model (auto-rollback).
Never ships a model that can't beat the baseline (spec §4.3).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.config import get_settings
from app.db import get_db
from app.features.feature_builder import FeatureBuilder
from app.models.baseline import ActualRow, SeasonalBaseline, mape
from app.models.lgbm_model import DemandModel
from app.models.registry import ModelRegistry


async def train_city(city: str = "default") -> dict:
    s = get_settings()
    db = get_db()
    fb = FeatureBuilder(s.WINDOW_MINUTES)

    rows: list[ActualRow] = []
    history: dict[str, dict[datetime, float]] = {}
    async for a in db.demand_actuals.find().sort("windowStart", 1):
        hex_id, w, d = a["hexId"], a["windowStart"], float(a.get("rideRequests", 0))
        rows.append(ActualRow(hexId=hex_id, window_start=w, demand=d))
        history.setdefault(hex_id, {})[w] = d

    if len(rows) < s.MIN_TRAIN_ROWS:
        return {"trained": False, "reason": "cold_start", "rows": len(rows)}

    # Chronological split: last 20% is the holdout.
    rows.sort(key=lambda r: r.window_start)
    split = int(len(rows) * 0.8)
    train_rows, holdout = rows[:split], rows[split:]

    X, y = [], []
    for r in train_rows:
        feats = fb.build(r.hexId, r.window_start, history.get(r.hexId, {}), 0, 0.0, 0.0)
        X.append(feats.to_vector())
        y.append(r.demand)

    version = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    try:
        model = DemandModel.train(X, y, version)
    except Exception as exc:  # LightGBM unavailable at runtime -> keep baseline
        return {"trained": False, "reason": f"lgbm_error: {exc}"}

    # Evaluate both models on the holdout.
    baseline = SeasonalBaseline(s.WINDOW_MINUTES).fit(train_rows)
    y_true = [r.demand for r in holdout]
    y_model = model.predict([
        fb.build(r.hexId, r.window_start, history.get(r.hexId, {}), 0, 0.0, 0.0) for r in holdout
    ])
    y_base = [baseline.predict(r.hexId, r.window_start) for r in holdout]

    model_mape = mape(y_true, y_model)
    base_mape = mape(y_true, y_base)

    registry = ModelRegistry()
    shadow_id = await registry.save(
        city, model,
        {"mape": model_mape, "baselineMape": base_mape, "holdout": len(holdout)},
        status="shadow",
    )
    # Ship only if it beats the baseline AND the current active model.
    promoted = False
    if model_mape < base_mape:
        promoted = await registry.promote_if_better(city, shadow_id)

    return {
        "trained": True, "version": version, "mape": round(model_mape, 4),
        "baselineMape": round(base_mape, 4), "promoted": promoted,
    }
