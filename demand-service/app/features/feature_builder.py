"""
Feature engineering for the demand model (spec §4.3 feature set): temporal
features, lags, rolling averages, calendar flags, supply, completed/cancelled
ratio. Weather/traffic/events are optional and degrade to seasonal features
when unavailable (spec §4.8 — never fail the fare path).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional


# Algeria + neighbouring markets — override via an admin calendar feed.
DEFAULT_HOLIDAYS: set = set()


@dataclass
class WindowFeatures:
    hexId: str
    window_start: datetime
    hour: int
    day_of_week: int
    is_weekend: int
    is_holiday: int
    is_payday: int
    lag_15m: float
    lag_1h: float
    lag_1d: float
    lag_1w: float
    roll_1h_avg: float
    active_supply: int
    completed_ratio: float
    cancelled_ratio: float
    # Optional external signals (0/neutral when the API is down).
    temp: float = 0.0
    precip: float = 0.0
    traffic_index: float = 0.0
    event_proximity: float = 0.0
    extra: Dict = field(default_factory=dict)

    def to_vector(self) -> List[float]:
        return [
            self.hour, self.day_of_week, self.is_weekend, self.is_holiday,
            self.is_payday, self.lag_15m, self.lag_1h, self.lag_1d, self.lag_1w,
            self.roll_1h_avg, self.active_supply, self.completed_ratio,
            self.cancelled_ratio, self.temp, self.precip, self.traffic_index,
            self.event_proximity,
        ]

    @staticmethod
    def feature_names() -> List[str]:
        return [
            "hour", "day_of_week", "is_weekend", "is_holiday", "is_payday",
            "lag_15m", "lag_1h", "lag_1d", "lag_1w", "roll_1h_avg",
            "active_supply", "completed_ratio", "cancelled_ratio",
            "temp", "precip", "traffic_index", "event_proximity",
        ]


def is_payday(dt: datetime) -> int:
    # Common paydays: 1st and month-end (config-driven per market later).
    return 1 if dt.day in (1, 28, 29, 30, 31) else 0


class FeatureBuilder:
    def __init__(self, window_minutes: int = 15, holidays: Optional[set] = None):
        self.window_minutes = window_minutes
        self.holidays = holidays if holidays is not None else DEFAULT_HOLIDAYS

    def build(
        self,
        hex_id: str,
        window_start: datetime,
        history: Dict[datetime, float],
        supply: int,
        completed_ratio: float,
        cancelled_ratio: float,
        external: Optional[Dict] = None,
    ) -> WindowFeatures:
        wm = timedelta(minutes=self.window_minutes)
        ext = external or {}

        def lag(delta: timedelta) -> float:
            return history.get(window_start - delta, 0.0)

        recent = [history.get(window_start - wm * i, 0.0) for i in range(1, 5)]
        roll = sum(recent) / len(recent) if recent else 0.0

        return WindowFeatures(
            hexId=hex_id,
            window_start=window_start,
            hour=window_start.hour,
            day_of_week=window_start.weekday(),
            is_weekend=1 if window_start.weekday() >= 5 else 0,
            is_holiday=1 if window_start.date() in self.holidays else 0,
            is_payday=is_payday(window_start),
            lag_15m=lag(wm),
            lag_1h=lag(timedelta(hours=1)),
            lag_1d=lag(timedelta(days=1)),
            lag_1w=lag(timedelta(weeks=1)),
            roll_1h_avg=roll,
            active_supply=supply,
            completed_ratio=completed_ratio,
            cancelled_ratio=cancelled_ratio,
            temp=float(ext.get("temp", 0.0)),
            precip=float(ext.get("precip", 0.0)),
            traffic_index=float(ext.get("traffic_index", 0.0)),
            event_proximity=float(ext.get("event_proximity", 0.0)),
        )
