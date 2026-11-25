"""Run the instalment billing job once (issue due invoices, send reminders, deliver queued emails).

  python scripts/run_billing.py                 # as of today (Sri Lanka time)
  python scripts/run_billing.py --date 2027-01-15 --no-send   # dry-ish run for a date, emails stay queued

The API already runs this every BILLING_EVERY_MINUTES; use this from a server timer as a backup.
"""
import argparse
import asyncio
from datetime import date

import _bootstrap  # noqa: F401

from app.core.database import SessionLocal
from app.modules.payments.jobs import run_billing


async def main(as_of: date | None, send: bool) -> None:
    async with SessionLocal() as db:
        print(await run_billing(db, as_of, send=send))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", type=date.fromisoformat)
    ap.add_argument("--no-send", action="store_true")
    a = ap.parse_args()
    asyncio.run(main(a.date, not a.no_send))
