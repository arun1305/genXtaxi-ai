import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.baseline import SeasonalBaseline, ActualRow, mape  # noqa: E402


def test_seasonal_baseline_predicts_same_slot_mean():
    rows = [
        # Two Mondays 09:00 -> demand 10 and 20 => mean 15
        ActualRow("hexA", datetime(2026, 6, 1, 9, 0), 10),
        ActualRow("hexA", datetime(2026, 6, 8, 9, 0), 20),
    ]
    bl = SeasonalBaseline(15).fit(rows)
    # A future Monday 09:07 -> same weekday/hour/quarter-hour bucket.
    assert bl.predict("hexA", datetime(2026, 6, 15, 9, 7)) == 15.0


def test_baseline_zero_for_unseen_slot():
    bl = SeasonalBaseline(15).fit([ActualRow("hexA", datetime(2026, 6, 1, 9, 0), 10)])
    assert bl.predict("hexA", datetime(2026, 6, 1, 18, 0)) == 0.0


def test_mape_skips_zero_actuals():
    assert mape([0, 10], [5, 11]) == 0.1  # only the 10 vs 11 pair counts


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn(); print(f"PASS {fn.__name__}")
    print(f"\n{len(fns)} passed")
