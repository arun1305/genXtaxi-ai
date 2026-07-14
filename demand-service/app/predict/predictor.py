"""
Batch predictor (spec §4.3): every few minutes, predict demand for the next N
15-min windows per active hex and write to Redis (hot) + Mongo (audit). Falls
back to the seasonal baseline on cold start / missing model (spec §4.8).
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from app.config import get_settings
from app.db import get_db, get_redis
from app.features.feature_builder import FeatureBuilder
from app.models.baseline import SeasonalBaseline, ActualRow
from app.models.registry import ModelRegistry


def _floor_window(dt: datetime, minutes: int) -> datetime:
    discard = timedelta(minutes=dt.minute % minutes, seconds=dt.second, microseconds=dt.microsecond)
    return dt - discard


def redis_key(city: str, hex_id: str, window: datetime) -> str:
    return f"pred:{city}:{hex_id}:{int(window.timestamp())}"


class Predictor:
    def __init__(self, city: str = "default"):
        self.city = city
        self.settings = get_settings()
        self.registry = ModelRegistry()
        self.fb = FeatureBuilder(self.settings.WINDOW_MINUTES)

    async def _load_history(self) -> dict:
        """Recent actuals as {hexId: {window: demand}} for lags + baseline fit."""
        db = get_db()
        since = datetime.now(timezone.utc) - timedelta(weeks=2)
        history: dict[str, dict[datetime, float]] = {}
        rows: list[ActualRow] = []
        async for a in db.demand_actuals.find({"windowStart": {"$gte": since}}):
            hex_id, w, d = a["hexId"], a["windowStart"], float(a.get("rideRequests", 0))
            history.setdefault(hex_id, {})[w] = d
            rows.append(ActualRow(hexId=hex_id, window_start=w, demand=d))
        return {"history": history, "rows": rows}

    async def _active_supply(self, hex_id: str) -> int:
        # Supply from driver locations is resolved by the surge service; the
        # predictor only needs demand. Kept 0 here (feature is supply-agnostic
        # for the demand target).
        return 0

    async def run(self) -> int:
        db = get_db()
        r = get_redis()
        loaded = await self._load_history()
        history, rows = loaded["history"], loaded["rows"]
        if len(rows) < 1:
            return 0

        baseline = SeasonalBaseline(self.settings.WINDOW_MINUTES).fit(rows)
        model = await self.registry.load_active(self.city)

        now = _floor_window(datetime.now(timezone.utc), self.settings.WINDOW_MINUTES)
        horizon = self.settings.PREDICT_HORIZON_WINDOWS
        wm = timedelta(minutes=self.settings.WINDOW_MINUTES)
        written = 0

        for hex_id, hist in history.items():
            for i in range(1, horizon + 1):
                window = now + wm * i
                if model and model.trained:
                    feats = self.fb.build(
                        hex_id, window, hist,
                        supply=await self._active_supply(hex_id),
                        completed_ratio=0.0, cancelled_ratio=0.0,
                    )
                    predicted = model.predict([feats])[0]
                    model_version = model.version
                else:
                    predicted = baseline.predict(hex_id, window)
                    model_version = "baseline"

                key = redis_key(self.city, hex_id, window)
                await r.set(
                    key,
                    json.dumps({"predicted": round(predicted, 3), "modelVersion": model_version}),
                    ex=self.settings.WINDOW_MINUTES * 60 * (horizon + 2),
                )
                await db.demand_predictions.update_one(
                    {"hexId": hex_id, "windowStart": window},
                    {"$set": {
                        "hexId": hex_id, "windowStart": window,
                        "predicted": round(predicted, 3), "modelVersion": model_version,
                        "createdAt": datetime.now(timezone.utc),
                    }},
                    upsert=True,
                )
                written += 1
        return written
