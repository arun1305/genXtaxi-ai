"""Surge engine is a hard acceptance item (spec §4.9: never exceeds cap, every
multiplier auditable, kill-switch works). Pure-stdlib — runs without ML deps."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.surge.surge_engine import (  # noqa: E402
    SurgeConfig, SurgeState, compute_surge, round_to_step, ratio_to_multiplier,
)

CFG = SurgeConfig(max_surge=2.0, step=0.1, max_step_change=0.3,
                  min_dwell_seconds=300, ewma_alpha=0.5)


def test_balanced_supply_no_surge():
    d = compute_surge("h1", predicted_demand=5, active_drivers=10, cfg=CFG,
                      prior=None, now_epoch=1000)
    assert d.multiplier == 1.0
    assert d.reason == "computed"


def test_scarcity_raises_but_never_exceeds_cap():
    d = compute_surge("h1", predicted_demand=100, active_drivers=1, cfg=CFG,
                      prior=None, now_epoch=1000)
    assert d.multiplier <= CFG.max_surge
    assert d.multiplier > 1.0


def test_kill_switch_forces_1x():
    d = compute_surge("h1", predicted_demand=100, active_drivers=1, cfg=CFG,
                      prior=None, now_epoch=1000, kill_switch=True)
    assert d.multiplier == 1.0
    assert d.overridden and d.reason == "kill_switch"


def test_manual_override_is_capped():
    d = compute_surge("h1", predicted_demand=0, active_drivers=99, cfg=CFG,
                      prior=None, now_epoch=1000, manual_override=5.0)
    assert d.multiplier == CFG.max_surge  # 5.0 capped to 2.0
    assert d.reason == "manual_override"


def test_min_dwell_holds_recent_value():
    prior = SurgeState(multiplier=1.5, updated_at_epoch=1000, ewma=1.5)
    # Big demand would push higher, but only 100s elapsed (< 300 dwell).
    d = compute_surge("h1", predicted_demand=50, active_drivers=1, cfg=CFG,
                      prior=prior, now_epoch=1100)
    assert d.multiplier == 1.5
    assert d.reason == "dwell_hold"


def test_anti_shock_caps_step_change():
    prior = SurgeState(multiplier=1.0, updated_at_epoch=0, ewma=1.0)
    d = compute_surge("h1", predicted_demand=1000, active_drivers=1, cfg=CFG,
                      prior=prior, now_epoch=100000)
    # From 1.0, one window can move at most +0.3.
    assert d.multiplier <= 1.0 + CFG.max_step_change + 1e-9


def test_round_to_step():
    assert round_to_step(1.44, 0.1) == 1.4
    assert round_to_step(1.46, 0.1) == 1.5


def test_ratio_curve_monotonic():
    assert ratio_to_multiplier(0.5) == 1.0
    assert ratio_to_multiplier(2.0) > ratio_to_multiplier(1.5)


if __name__ == "__main__":
    # Runnable without pytest.
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\n{len(fns)} passed")
