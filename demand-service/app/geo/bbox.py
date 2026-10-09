"""Pure bbox parsing/validation for the heatmap endpoint."""
from __future__ import annotations


def parse_bbox(raw: str) -> tuple[float, float, float, float]:
    """Parse "min_lng,min_lat,max_lng,max_lat"; raise ValueError on bad input."""
    parts = raw.split(",")
    if len(parts) != 4:
        raise ValueError("bbox must be min_lng,min_lat,max_lng,max_lat")
    min_lng, min_lat, max_lng, max_lat = (float(p) for p in parts)
    if not (-180 <= min_lng <= max_lng <= 180 and -90 <= min_lat <= max_lat <= 90):
        raise ValueError("bbox out of range or min > max")
    return min_lng, min_lat, max_lng, max_lat
