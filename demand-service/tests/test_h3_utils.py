import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.geo.h3_utils import (  # noqa: E402
    latlng_to_cell, cell_to_latlng, cell_to_boundary, cells_in_bbox,
)

# Algiers city centre.
LAT, LNG = 36.7538, 3.0588


def test_cell_is_stable_and_string():
    a = latlng_to_cell(LAT, LNG, 8)
    b = latlng_to_cell(LAT, LNG, 8)
    assert a == b and isinstance(a, str)


def test_nearby_points_share_a_cell():
    a = latlng_to_cell(LAT, LNG, 8)
    b = latlng_to_cell(LAT + 0.0001, LNG + 0.0001, 8)
    assert a == b


def test_boundary_is_polygon():
    cell = latlng_to_cell(LAT, LNG, 8)
    boundary = cell_to_boundary(cell)
    assert len(boundary) >= 4
    assert all(len(p) == 2 for p in boundary)


def test_bbox_enumeration_nonempty():
    cells = cells_in_bbox(LAT - 0.02, LNG - 0.02, LAT + 0.02, LNG + 0.02, 8)
    assert len(cells) >= 1
    assert latlng_to_cell(LAT, LNG, 8) in cells


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn(); print(f"PASS {fn.__name__}")
    print(f"\n{len(fns)} passed")
