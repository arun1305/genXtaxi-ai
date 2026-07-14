"""API response models (spec §4.7)."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class HeatmapCell(BaseModel):
    hex: str
    predicted: float
    surge: float
    boundary: List[List[float]]  # [[lat,lng], ...] for map polygons


class HeatmapResponse(BaseModel):
    city: str
    window: int  # epoch seconds of the predicted window
    cells: List[HeatmapCell]


class SurgeResponse(BaseModel):
    hex: str
    multiplier: float
    reason: str
    advisory: bool  # True this phase — not applied to live fares


class OverrideRequest(BaseModel):
    hex: Optional[str] = None
    multiplier: Optional[float] = None  # null => kill-switch for that hex/all
    ttl: int = 900


class EventRequest(BaseModel):
    name: str
    lat: float
    lng: float
    startAt: str
    endAt: str
    expectedAttendance: int = 0
    source: str = "admin"


class ModelHealth(BaseModel):
    city: str
    activeVersion: Optional[str]
    activeMape: Optional[float]
    baselineMape: Optional[float]
    beatsBaselinePct: Optional[float]
    drift: Optional[float]
    lastTrainedAt: Optional[str]
