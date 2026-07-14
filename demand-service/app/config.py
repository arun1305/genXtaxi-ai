"""Environment-driven settings (spec §4.8: config-driven caps per country)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENV: str = "development"
    PORT: int = 8084

    MONGODB_URI: str = "mongodb://localhost:27017/genxtaxi_ai"
    MONGODB_DB: str = "genxtaxi_ai"
    REDIS_URL: str = "redis://localhost:6379"

    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"

    H3_RESOLUTION: int = 8
    WINDOW_MINUTES: int = 15

    # Surge engine — MAX_SURGE and rules are config-driven per market (spec §4.8).
    MAX_SURGE: float = 2.0
    SURGE_STEP: float = 0.1
    SURGE_MAX_STEP_CHANGE: float = 0.3
    SURGE_MIN_DWELL_SECONDS: int = 300
    SURGE_EWMA_ALPHA: float = 0.5
    SURGE_ADVISORY: bool = True

    PREDICT_CRON_SECONDS: int = 300
    PREDICT_HORIZON_WINDOWS: int = 8
    RETRAIN_NIGHTLY_CRON: str = "0 3 * * *"
    RETRAIN_WEEKLY_CRON: str = "0 4 * * 0"

    MIN_TRAIN_ROWS: int = 500


@lru_cache
def get_settings() -> Settings:
    return Settings()
