"""
LightGBM demand regressor per city (spec §4.3). Wrapped so training/predict are
swappable and the seasonal baseline can stand in when there is not enough data
(cold start — spec §4.8) or LightGBM is unavailable at runtime.
"""
from __future__ import annotations

import pickle
from typing import List, Optional

from app.features.feature_builder import WindowFeatures


class DemandModel:
    """Thin wrapper around a LightGBM booster with a graceful fallback."""

    def __init__(self, booster: Optional[object] = None, version: str = "0"):
        self._booster = booster
        self.version = version

    @property
    def trained(self) -> bool:
        return self._booster is not None

    @staticmethod
    def train(X: List[List[float]], y: List[float], version: str) -> "DemandModel":
        import lightgbm as lgb  # imported lazily so tests don't need the wheel

        dataset = lgb.Dataset(X, label=y, feature_name=WindowFeatures.feature_names())
        params = {
            "objective": "regression",
            "metric": "mape",
            "num_leaves": 31,
            "learning_rate": 0.05,
            "min_data_in_leaf": 20,
            "verbose": -1,
        }
        booster = lgb.train(params, dataset, num_boost_round=200)
        return DemandModel(booster=booster, version=version)

    def predict(self, features: List[WindowFeatures]) -> List[float]:
        if not self.trained:
            raise RuntimeError("model not trained")
        X = [f.to_vector() for f in features]
        preds = self._booster.predict(X)  # type: ignore[attr-defined]
        # Demand cannot be negative.
        return [max(0.0, float(p)) for p in preds]

    def serialize(self) -> bytes:
        return pickle.dumps({"version": self.version, "booster": self._booster})

    @staticmethod
    def deserialize(blob: bytes) -> "DemandModel":
        data = pickle.loads(blob)
        return DemandModel(booster=data["booster"], version=data["version"])
