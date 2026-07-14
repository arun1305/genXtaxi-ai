"""
Deterministic surge engine (spec §4.4). Rules + prediction, never a black box
(regulatory + trust). Pure-stdlib so it is fully unit-testable without ML deps.

    supply_demand_ratio = predicted_demand / max(active_available_drivers, 1)
    raw_multiplier      = clamp(f(ratio), 1.0, MAX_SURGE)
    smoothed            = EWMA(raw_multiplier)         # avoid whiplash
    final_surge         = round_to_step(smoothed, 0.1)

Constraints: hard cap (per-city), max step change per window (anti-shock),
minimum dwell time before changing, admin kill-switch / manual override.
Every decision returns its full input breakdown for audit (spec §4.4/§4.8).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class SurgeConfig:
    max_surge: float = 2.0
    step: float = 0.1
    max_step_change: float = 0.3
    min_dwell_seconds: int = 300
    ewma_alpha: float = 0.5


@dataclass
class SurgeState:
    """Prior state for a hex, used for smoothing + dwell/step constraints."""
    multiplier: float = 1.0
    updated_at_epoch: float = 0.0
    ewma: float = 1.0


@dataclass
class SurgeDecision:
    hexId: str
    multiplier: float
    ratio: float
    predicted_demand: float
    active_drivers: int
    raw_multiplier: float
    smoothed: float
    reason: str
    overridden: bool = False
    inputs: dict = field(default_factory=dict)


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def round_to_step(value: float, step: float) -> float:
    return round(round(value / step) * step, 2)


def ratio_to_multiplier(ratio: float) -> float:
    """
    Monotonic curve f(ratio) -> multiplier. Balanced supply (ratio<=1) stays at
    1.0; scarcity raises the multiplier smoothly (clamped by the caller).
    """
    if ratio <= 1.0:
        return 1.0
    # +1.0x surge per unit of excess demand, gentle sub-linear growth.
    return 1.0 + 0.5 * (ratio - 1.0)


def compute_surge(
    hex_id: str,
    predicted_demand: float,
    active_drivers: int,
    cfg: SurgeConfig,
    prior: Optional[SurgeState],
    now_epoch: float,
    *,
    kill_switch: bool = False,
    manual_override: Optional[float] = None,
) -> SurgeDecision:
    inputs = {
        "predicted_demand": predicted_demand,
        "active_drivers": active_drivers,
        "cfg": cfg.__dict__,
        "prior_multiplier": prior.multiplier if prior else None,
    }

    # 1. Kill-switch / admin override short-circuit (spec §4.4).
    if kill_switch:
        return SurgeDecision(
            hexId=hex_id, multiplier=1.0, ratio=0.0,
            predicted_demand=predicted_demand, active_drivers=active_drivers,
            raw_multiplier=1.0, smoothed=1.0,
            reason="kill_switch", overridden=True, inputs=inputs,
        )
    if manual_override is not None:
        capped = clamp(manual_override, 1.0, cfg.max_surge)
        return SurgeDecision(
            hexId=hex_id, multiplier=round_to_step(capped, cfg.step), ratio=0.0,
            predicted_demand=predicted_demand, active_drivers=active_drivers,
            raw_multiplier=capped, smoothed=capped,
            reason="manual_override", overridden=True, inputs=inputs,
        )

    # 2. Ratio -> raw multiplier, clamped by the hard cap.
    ratio = predicted_demand / max(active_drivers, 1)
    raw = clamp(ratio_to_multiplier(ratio), 1.0, cfg.max_surge)

    # 3. EWMA smoothing to avoid whiplash.
    prior_ewma = prior.ewma if prior else 1.0
    smoothed = cfg.ewma_alpha * raw + (1 - cfg.ewma_alpha) * prior_ewma

    # 4. Anti-shock: cap the per-window step change vs the last published value.
    prior_mult = prior.multiplier if prior else 1.0
    if prior is not None:
        delta = smoothed - prior_mult
        if abs(delta) > cfg.max_step_change:
            smoothed = prior_mult + cfg.max_step_change * (1 if delta > 0 else -1)

    final = clamp(round_to_step(smoothed, cfg.step), 1.0, cfg.max_surge)

    # 5. Minimum dwell: hold the prior value if it changed too recently.
    reason = "computed"
    if prior is not None and final != prior_mult:
        if now_epoch - prior.updated_at_epoch < cfg.min_dwell_seconds:
            final = prior_mult
            reason = "dwell_hold"

    return SurgeDecision(
        hexId=hex_id, multiplier=final, ratio=round(ratio, 3),
        predicted_demand=predicted_demand, active_drivers=active_drivers,
        raw_multiplier=round(raw, 3), smoothed=round(smoothed, 3),
        reason=reason, overridden=False, inputs=inputs,
    )
