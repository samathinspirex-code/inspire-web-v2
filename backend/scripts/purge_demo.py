"""Delete demo accounts past their 24h expiry, with all their data. For a server timer (e.g. every 15 min)."""
import asyncio

import _bootstrap  # noqa: F401

from app.core.database import SessionLocal
from app.modules.demo.service import purge_expired


async def main() -> None:
    async with SessionLocal() as db:
        print("Purged", await purge_expired(db), "expired demo account(s)")


asyncio.run(main())
