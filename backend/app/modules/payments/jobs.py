"""Billing job: issue upcoming instalment invoices, send reminders, deliver queued emails.

Runs every BILLING_EVERY_MINUTES from the API process (app/main.py) and can also be run by a server timer
(scripts/run_billing.py). A Postgres advisory lock (held on its own connection) makes sure two runs never
overlap; dedupe keys on emails make each automatic email go out once even if the job runs many times a day.
"""
from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import engine
from app.modules.payments import billing, mailer

LOCK_ID = 727140215


async def _work(db: AsyncSession, as_of: date, send: bool) -> dict:
    cfg = await billing.billing_settings(db)
    issued = await billing.issue_due(db, as_of, cfg)
    reminded = await billing.send_reminders(db, as_of, cfg)
    await db.commit()
    mail = await mailer.flush(db) if send else {}
    return {"as_of": as_of.isoformat(), "issued": issued, "reminders": reminded, "email": mail}


async def run_billing(db: AsyncSession, as_of: date | None = None, send: bool = True) -> dict:
    as_of = as_of or billing.today()
    if engine.dialect.name != "postgresql":
        return await _work(db, as_of, send)
    async with engine.connect() as lock_conn:
        got = (await lock_conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": LOCK_ID})).scalar()
        await lock_conn.commit()
        if not got:
            return {"skipped": "another billing run is in progress"}
        try:
            return await _work(db, as_of, send)
        finally:
            await lock_conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": LOCK_ID})
            await lock_conn.commit()
