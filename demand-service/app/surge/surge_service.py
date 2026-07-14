"""
Applies the deterministic surge engine over hexes using predicted demand +
active supply. ADVISORY this phase (spec decision) — writes surge_state for the
admin panel + rider indicator + shadow comparison, but does NOT feed live fares.
Reads admin kill-switch / override from Redis. Logs every decision (spec §4.4).
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from app.config import get_settings
from app.db import get_db, get_redis
from app.geo.h3_utils import cell_to_latlng
from app.surge.surge_engine import SurgeConfig, SurgeState, compute_surge, SurgeDecision


class SurgeService:
    def __init__(self, city: str = "default"):
        self.city = city
        self.s = get_settings()
        self.cfg = SurgeConfig(
            max_surge=self.s.MAX_SURGE,
            step=self.s.SURGE_STEP,
            max_step_change=self.s.SURGE_MAX_STEP_CHANGE,
            min_dwell_seconds=self.s.SURGE_MIN_DWELL_SECONDS,
            ewma_alpha=self.s.SURGE_EWMA_ALPHA,
        )

    def _state_key(self, hex_id: str) -> str:
        return f"surge_state:{self.city}:{hex_id}"

    def _override_key(self) -> str:
        return f"surge_override:{self.city}"

    async def _active_drivers(self, hex_id: str) -> int:
        """Count online + idle drivers near the hex centre (supply)."""
        db = get_db()
        lat, lng = cell_to_latlng(hex_id)
        try:
            return await db.drivers.count_documents({
                "isOnline": True,
                "currentLocation": {
                    "$near": {
                        "$geometry": {"type": "Point", "coordinates": [lng, lat]},
                        "$maxDistance": 1500,
                    }
                },
            })
        except Exception:
            return 0

    async def _prior(self, hex_id: str) -> SurgeState | None:
        raw = await get_redis().get(self._state_key(hex_id))
        if not raw:
            return None
        d = json.loads(raw)
        return SurgeState(multiplier=d["multiplier"], updated_at_epoch=d["updatedAt"], ewma=d["ewma"])

    async def compute_for_hex(self, hex_id: str, predicted_demand: float) -> SurgeDecision:
        r = get_redis()
        overrides = json.loads(await r.get(self._override_key()) or "{}")
        kill = bool(overrides.get("kill_all")) or hex_id in overrides.get("kill_hexes", [])
        manual = overrides.get("hexes", {}).get(hex_id)

        drivers = await self._active_drivers(hex_id)
        prior = await self._prior(hex_id)
        now = datetime.now(timezone.utc).timestamp()

        decision = compute_surge(
            hex_id, predicted_demand, drivers, self.cfg, prior, now,
            kill_switch=kill, manual_override=manual,
        )

        # Persist state (Redis hot) + audit (Mongo surge_state).
        await r.set(self._state_key(hex_id), json.dumps({
            "multiplier": decision.multiplier,
            "updatedAt": now if (prior is None or decision.multiplier != prior.multiplier) else prior.updated_at_epoch,
            "ewma": decision.smoothed,
        }))
        await get_db().surge_state.insert_one({
            "hexId": hex_id, "windowStart": datetime.now(timezone.utc),
            "multiplier": decision.multiplier, "ratio": decision.ratio,
            "activeDrivers": drivers, "reason": decision.reason,
            "overrideBy": "admin" if decision.overridden else None,
            "advisory": self.s.SURGE_ADVISORY, "createdAt": datetime.now(timezone.utc),
        })
        return decision

    async def set_override(self, hex_id: str | None, multiplier: float | None, ttl: int = 900) -> None:
        r = get_redis()
        overrides = json.loads(await r.get(self._override_key()) or "{}")
        overrides.setdefault("hexes", {})
        overrides.setdefault("kill_hexes", [])
        if hex_id is None:
            overrides["kill_all"] = multiplier is None
        elif multiplier is None:
            if hex_id not in overrides["kill_hexes"]:
                overrides["kill_hexes"].append(hex_id)
        else:
            overrides["hexes"][hex_id] = multiplier
        await r.set(self._override_key(), json.dumps(overrides), ex=ttl)
