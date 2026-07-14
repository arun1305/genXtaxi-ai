"""
Seasonal naive baseline (spec §4.3): same hex, same weekday+hour last week.
The ML model must beat this or it never ships. Pure-stdlib + testable.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Iterable, Tuple


@dataclass
class ActualRow:
    hexId: str
    window_start: datetime
    demand: float  # ride requests (incl. unmet) in the window


def _key(hex_id: str, dow: int, hour: int, minute_bucket: int) -> Tuple:
    return (hex_id, dow, hour, minute_bucket)


class SeasonalBaseline:
    """Predicts demand as the mean of the same hex/weekday/hour/quarter-hour."""

    def __init__(self, window_minutes: int = 15):
        self.window_minutes = window_minutes
        self._table: Dict[Tuple, Tuple[float, int]] = {}  # key -> (sum, count)

    def _bucket(self, dt: datetime) -> int:
        return (dt.minute // self.window_minutes)

    def fit(self, rows: Iterable[ActualRow]) -> "SeasonalBaseline":
        for r in rows:
            k = _key(r.hexId, r.window_start.weekday(), r.window_start.hour, self._bucket(r.window_start))
            s, c = self._table.get(k, (0.0, 0))
            self._table[k] = (s + r.demand, c + 1)
        return self

    def predict(self, hex_id: str, window_start: datetime) -> float:
        k = _key(hex_id, window_start.weekday(), window_start.hour, self._bucket(window_start))
        s, c = self._table.get(k, (0.0, 0))
        return s / c if c else 0.0


def mape(actual: Iterable[float], predicted: Iterable[float]) -> float:
    """Mean absolute percentage error (spec §4.9 holdout metric). Skips zeros."""
    total, n = 0.0, 0
    for a, p in zip(actual, predicted):
        if a == 0:
            continue
        total += abs(a - p) / abs(a)
        n += 1
    return (total / n) if n else 0.0
