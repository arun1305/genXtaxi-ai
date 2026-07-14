# GenXTaxi AI Platform — Phase 4 (Demand Prediction & Surge)

Implements spec §4: a new Python `demand-service` (FastAPI) predicting ride demand
per H3 hexagon per 15-min window, plus a deterministic surge engine. **Surge runs
ADVISORY / shadow this phase** (your chosen integration) — it powers the driver
heatmap, rider transparency indicator, admin panel, and MAPE comparison, but does
**not** change live fares (the existing gen-taxi-backend surge stays authoritative).

## Service

| Service | Port | Stack | Responsibility |
|---|---|---|---|
| `demand-service` | 8084 | Python 3.11 / FastAPI | ETL, LightGBM demand prediction, deterministic surge (advisory), heatmap + admin APIs, batch scheduler, model registry/retraining |

`Node consumes via ai-gateway` (spec §4.3): a new **ai-gateway demand proxy**
(`/api/v1/demand/heatmap`, `/surge`) forwards the caller's JWT to demand-service.

## Data reality vs spec

- **No H3, no weather/traffic/events infra.** Rides carry GeoJSON pickup coords +
  timestamps + status (`no_driver`/cancelled = **unmet demand**), drivers carry
  `currentLocation` + online flag.
- ETL (`actuals_etl.py`) watermark-scans the shared `rides` collection → `demand_actuals`
  per hex/window, counting **requests including unmet** (avoids the surge feedback
  loop — spec §4.8). Supply = online drivers near the hex centre (`$near`).
- `h3_utils.py` uses the `h3` library in prod and a **pure-stdlib fallback grid** so
  the service + tests run without the native wheel. Weather/traffic/events are
  optional features that degrade to seasonal (spec §4.8).

## Pipeline (spec §4.3)

```
PREDICT_CRON (5m): actuals ETL → predict next 8 windows/hex (Redis + Mongo) → advisory surge
RETRAIN nightly (incremental) + weekly (full): train LightGBM shadow → compare
   holdout MAPE vs seasonal baseline → promote only if it beats baseline AND active
   model (auto-rollback). Never ships a model that can't beat the baseline (§4.3).
```

- **Baseline:** seasonal naive (same hex/weekday/hour last week) — the bar every model
  must clear.
- **Surge engine** (`surge_engine.py`, spec §4.4, pure-stdlib, **unit-tested**):
  `ratio = predicted/max(drivers,1)` → `clamp(f(ratio),1,MAX_SURGE)` → EWMA smoothing →
  anti-shock step cap → min-dwell hold → `round_to_step(0.1)`. Admin kill-switch +
  per-zone manual override (Redis). Every decision logged to `surge_state` for audit.

## Collections (spec §4.6)

`demand_actuals`, `demand_predictions`, `surge_state` (advisory), `events` (2dsphere),
`model_registry` (shadow/active/retired), plus `demand_watermarks` (ETL bookkeeping).

## APIs (spec §4.7)

- `GET /api/v1/demand/heatmap?city=&bbox=` — driver heatmap (predicted + surge + hex boundary)
- `GET /api/v1/demand/surge?hex=` — rider advisory multiplier + reason
- `WS /ws/demand/heatmap` — pushed surge deltas
- `POST /api/v1/admin/surge/override` — per-zone override / kill-switch (< 5s effect)
- `POST /api/v1/admin/events` — register an event signal
- `GET /api/v1/admin/demand/model-health` — MAPE vs baseline, live drift, versions

## Frontend

- **Driver RN:** `components/DemandHeatmapOverlay.tsx` — H3 hex polygons over the map,
  coloured by predicted demand / surge; `demand.api.ts`.
- **Rider RN:** `components/SurgeIndicator.tsx` — transparent "prices higher — 1.4×"
  banner before confirming (advisory-labelled).
- **Admin:** `pages/ai/SurgeControlPage.tsx` at `/ai/surge` — model health (MAPE vs
  baseline, drift), per-zone override / kill-switch, event calendar input, advisory banner.

## Environment

`MONGODB_URI, MONGODB_DB, REDIS_URL, JWT_SECRET, JWT_ALGORITHM, H3_RESOLUTION=8,
WINDOW_MINUTES=15, MAX_SURGE=2.0, SURGE_STEP=0.1, SURGE_MAX_STEP_CHANGE=0.3,
SURGE_MIN_DWELL_SECONDS=300, SURGE_EWMA_ALPHA=0.5, SURGE_ADVISORY=true,
PREDICT_CRON_SECONDS=300, PREDICT_HORIZON_WINDOWS=8, RETRAIN_NIGHTLY_CRON,
RETRAIN_WEEKLY_CRON, MIN_TRAIN_ROWS=500`. ai-gateway: `DEMAND_SERVICE_URL`.
Admin: `VITE_DEMAND_SERVICE_URL`. RN: `EXPO_PUBLIC_AI_GATEWAY_URL`.

## Run / test / deploy

```bash
cd demand-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8084        # /docs

# Tests (pure-stdlib core — no ML deps needed):
python3 -m pytest -q                     # or: python3 tests/test_surge_engine.py
docker build -f demand-service/Dockerfile -t genxtaxi/demand-service:1.0 .
```

## Acceptance status (spec §4.9)

- ✅ Surge never exceeds configured cap; every multiplier auditable to inputs (unit-tested).
- ✅ Kill-switch disables surge (override takes effect next cycle; target < 5s).
- ✅ Baseline always kept; model promoted only if it beats it on holdout MAPE.
- ⏳ "MAPE beats baseline by ≥15%" and heatmap latency require **real historical ride
  data** to validate — the training + eval + promotion path is built and gated on it.
- Rider sees surge before confirming (advisory indicator); wiring it into the charged
  fare is the promotion step (flip `SURGE_ADVISORY=false` + feed ai-gateway → fare
  service) — deliberately deferred per the advisory-first decision.

## Promotion path (when ready)

1. Accumulate ride history; confirm model beats baseline ≥15% via `/model-health`.
2. Shadow-compare `surge_state` vs the live engine.
3. Flip `SURGE_ADVISORY=false`, disable the legacy `surge.cron`, and have
   `/rides/estimate` read the multiplier through ai-gateway (stamped on the quote per §4.7).
