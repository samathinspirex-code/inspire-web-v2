"""Settings for the Inspire Web v2 backend. Everything comes from backend/.env."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


# backend/ folder: .env, the local database and media live here wherever the server is started from
BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Inspire Web v2 API"
    ENVIRONMENT: str = "development"

    # New, separate database. Supabase: paste the Session pooler URI here.
    # Local default is a file database so the app runs without Postgres.
    DATABASE_URL: str = "sqlite+aiosqlite:///" + (BASE_DIR / "data" / "inspire_web_v2.db").as_posix()

    DATABASE_PASSWORD: str = ""   # optional: the DB password on its own line (no URL-encoding needed)

    JWT_SECRET: str = "change-me-in-env"
    ADMIN_TOKEN_HOURS: int = 12

    # Frontend origin(s) allowed to call the API
    CORS_ORIGINS: list[str] = ["http://localhost:3110", "http://127.0.0.1:3110"]
    SITE_URL: str = "http://localhost:3110"          # public website (frontend)
    PUBLIC_BASE_URL: str = "http://localhost:8120"    # this API, reachable by PayHere for notify

    # Demo accounts
    DEMO_TTL_HOURS: int = 24
    DEMO_PURGE_EVERY_MINUTES: int = 15

    # PayHere (sandbox first; switch to live by env only)
    PAYHERE_MODE: str = "sandbox"
    PAYHERE_MERCHANT_ID: str = ""
    PAYHERE_MERCHANT_SECRET: str = ""

    # Email through Mailjet (same account as the current API). Off until MAIL_ENABLED=true.
    MAILJET_API_KEY: str = ""
    MAILJET_SECRET_KEY: str = ""
    MAIL_ENABLED: bool = False
    MAIL_FROM_EMAIL: str = "enrol@inspire.college"
    MAIL_FROM_NAME: str = "Inspire College"
    MAIL_TEST_TO: str = ""        # while testing: every email goes to this inbox instead of the student

    # Instalment billing job (issue invoices, reminders, send emails)
    BILLING_EVERY_MINUTES: int = 15

    # Bank slips: private folder, never served publicly
    SLIP_DIR: str = str(BASE_DIR / "data" / "slips")
    SLIP_MAX_BYTES: int = 5 * 1024 * 1024

    # Media uploads (local folder in dev)
    MEDIA_DIR: str = str(BASE_DIR / "data" / "media")
    MEDIA_PUBLIC_PATH: str = "/media"

    # Current live site API, read-only, used by scripts/import_from_current.py
    CURRENT_API_URL: str = "https://api.inspirecollege.lk"

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
