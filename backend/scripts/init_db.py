"""Create all tables in the NEW database named by DATABASE_URL (safe to re-run; never drops anything)."""
import asyncio

import _bootstrap  # noqa: F401

from app.core.config import settings
from app.core.database import DATABASE_URL, create_all


async def main() -> None:
    host = DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else DATABASE_URL
    print("Creating tables in:", host)
    if "inspirecollege" in host or "uqiejlukbrdfvmhuubpa" in host:
        raise SystemExit("Refusing: that looks like the CURRENT production database. Use the new project's URL.")
    await create_all()
    print("Done.", "(sqlite)" if settings.is_sqlite else "")


asyncio.run(main())
