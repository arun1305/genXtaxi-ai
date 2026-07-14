"""
H3 geospatial helpers (spec §4.2: Uber H3 res ~8, ~0.7km2). Uses the `h3`
library when available; otherwise falls back to a deterministic pseudo-hex grid
so the service (and its tests) run without the native wheel. The fallback keeps
the same API shape (string cell id, neighbours, boundary) for dev/CI.
"""
from __future__ import annotations

import math
from typing import List, Tuple

try:  # pragma: no cover - exercised at runtime, not in fallback tests
    import h3  # type: ignore

    _HAS_H3 = True
except Exception:  # pragma: no cover
    _HAS_H3 = False

# Approx degrees for a ~0.7km cell at res 8 (used only by the fallback grid).
_FALLBACK_CELL_DEG = 0.0075


def latlng_to_cell(lat: float, lng: float, resolution: int) -> str:
    if _HAS_H3:
        return h3.latlng_to_cell(lat, lng, resolution)
    # Deterministic grid id: snap to a fixed lattice and encode.
    la = math.floor(lat / _FALLBACK_CELL_DEG)
    lo = math.floor(lng / _FALLBACK_CELL_DEG)
    return f"g{resolution}_{la}_{lo}"


def cell_to_latlng(cell: str) -> Tuple[float, float]:
    if _HAS_H3 and not cell.startswith("g"):
        lat, lng = h3.cell_to_latlng(cell)
        return lat, lng
    _, la, lo = cell.split("_")
    return (
        (int(la) + 0.5) * _FALLBACK_CELL_DEG,
        (int(lo) + 0.5) * _FALLBACK_CELL_DEG,
    )


def cell_to_boundary(cell: str) -> List[Tuple[float, float]]:
    """Polygon boundary as [(lat, lng), ...] for map rendering."""
    if _HAS_H3 and not cell.startswith("g"):
        return [(lat, lng) for lat, lng in h3.cell_to_boundary(cell)]
    lat, lng = cell_to_latlng(cell)
    h = _FALLBACK_CELL_DEG / 2
    return [
        (lat - h, lng - h),
        (lat - h, lng + h),
        (lat + h, lng + h),
        (lat + h, lng - h),
    ]


def neighbours(cell: str, k: int = 1) -> List[str]:
    if _HAS_H3 and not cell.startswith("g"):
        return list(h3.grid_disk(cell, k))
    _, la, lo = cell.split("_")
    la, lo = int(la), int(lo)
    out = []
    for dla in range(-k, k + 1):
        for dlo in range(-k, k + 1):
            out.append(f"g8_{la + dla}_{lo + dlo}")
    return out


def cells_in_bbox(
    min_lat: float, min_lng: float, max_lat: float, max_lng: float, resolution: int
) -> List[str]:
    """Enumerate cells covering a bounding box (heatmap query — spec §4.7)."""
    cells = set()
    step = _FALLBACK_CELL_DEG if not _HAS_H3 else 0.005
    lat = min_lat
    while lat <= max_lat:
        lng = min_lng
        while lng <= max_lng:
            cells.add(latlng_to_cell(lat, lng, resolution))
            lng += step
        lat += step
    return sorted(cells)
