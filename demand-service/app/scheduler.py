"""
Batch scheduling (spec §4.3): ETL+predict+surge every PREDICT_CRON_SECONDS;
nightly incremental + weekly full retrain. Runs the deterministic surge over
predicted hexes and writes advisory surge_state.
"""
from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.config import get_settings
from app.features.actuals_etl import run_actuals_etl
from app.models.trainer import train_city
from app.predict.predictor import Predictor
from app.surge.surge_service import SurgeService

log = logging.getLogger("demand.scheduler")


async def _predict_cycle() -> None:
    try:
        await run_actuals_etl()
        written = await Predictor().run()
        # Compute advisory surge for hexes that have a recent prediction.
        from app.db import get_db
        surge = SurgeService()
        seen = set()
        async for p in get_db().demand_predictions.find().sort("windowStart", -1).limit(2000):
            if p["hexId"] in seen:
                continue
            seen.add(p["hexId"])
            await surge.compute_for_hex(p["hexId"], float(p.get("predicted", 0)))
        log.info("predict cycle: %s predictions, %s hexes surged", written, len(seen))
    except Exception as exc:  # never crash the loop
        log.error("predict cycle failed: %s", exc)


async def _retrain(full: bool) -> None:
    try:
        res = await train_city()
        log.info("retrain (%s): %s", "full" if full else "incremental", res)
    except Exception as exc:
        log.error("retrain failed: %s", exc)


def build_scheduler() -> AsyncIOScheduler:
    s = get_settings()
    sched = AsyncIOScheduler(timezone="UTC")
    sched.add_job(_predict_cycle, IntervalTrigger(seconds=s.PREDICT_CRON_SECONDS), id="predict")
    sched.add_job(_retrain, CronTrigger.from_crontab(s.RETRAIN_NIGHTLY_CRON), id="retrain_nightly", kwargs={"full": False})
    sched.add_job(_retrain, CronTrigger.from_crontab(s.RETRAIN_WEEKLY_CRON), id="retrain_weekly", kwargs={"full": True})
    return sched
