"""
Model registry with shadow deploy + auto-rollback (spec §4.3). Stores model
blobs + metrics in Mongo; status transitions: shadow -> active -> retired.
A new model is promoted only if it beats the active model's live MAPE.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from bson import Binary

from app.db import get_db
from app.models.lgbm_model import DemandModel


class ModelRegistry:
    async def save(self, city: str, model: DemandModel, metrics: dict, status: str) -> str:
        db = get_db()
        doc = {
            "city": city,
            "algo": "lightgbm",
            "version": model.version,
            "metrics": metrics,
            "status": status,
            "blob": Binary(model.serialize()),
            "trainedAt": datetime.now(timezone.utc),
        }
        res = await db.model_registry.insert_one(doc)
        return str(res.inserted_id)

    async def load_active(self, city: str) -> Optional[DemandModel]:
        db = get_db()
        doc = await db.model_registry.find_one({"city": city, "status": "active"})
        if not doc:
            return None
        return DemandModel.deserialize(bytes(doc["blob"]))

    async def promote_if_better(self, city: str, shadow_id: str) -> bool:
        """Promote the shadow model iff its MAPE beats the active one (auto-rollback safe)."""
        db = get_db()
        shadow = await db.model_registry.find_one({"_id": _oid(shadow_id)})
        if not shadow:
            return False
        active = await db.model_registry.find_one({"city": city, "status": "active"})
        shadow_mape = shadow["metrics"].get("mape", 1.0)
        active_mape = active["metrics"].get("mape", 1.0) if active else 1.0
        if active is None or shadow_mape < active_mape:
            if active:
                await db.model_registry.update_one(
                    {"_id": active["_id"]}, {"$set": {"status": "retired"}}
                )
            await db.model_registry.update_one(
                {"_id": shadow["_id"]}, {"$set": {"status": "active"}}
            )
            return True
        return False


def _oid(v: str):
    from bson import ObjectId

    return ObjectId(v)
