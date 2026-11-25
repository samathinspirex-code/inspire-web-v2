"""Bring an existing database up to the current models: create missing tables and ADD missing columns.

  python scripts/upgrade_db.py

Safe to re-run. It never drops or changes existing columns or data. Refuses the current site's database.
Take a backup first (scripts/backup_db.py).
"""
import asyncio

import _bootstrap  # noqa: F401
from sqlalchemy import inspect

from app.core.database import DATABASE_URL, Base, create_all, engine

CURRENT_DB_MARKERS = ("inspirecollege", "uqiejlukbrdfvmhuubpa")
# Tables replaced by newer models. Dropped only when they hold no rows (otherwise left alone and reported).
LEGACY_TABLES = ["checkout_attempts", "orders"]   # replaced by enrolments / invoices / invoice_checkouts (2026-11-25)


def _missing(sync_conn):
    insp = inspect(sync_conn)
    out = []
    for table in Base.metadata.sorted_tables:
        have = {c["name"] for c in insp.get_columns(table.name)}
        for col in table.columns:
            if col.name not in have:
                out.append((table, col))
    return out


async def main() -> None:
    if any(m in DATABASE_URL for m in CURRENT_DB_MARKERS):
        raise SystemExit("Refusing: DATABASE_URL points at the current site's database.")
    async with engine.begin() as conn:
        existing = set(await conn.run_sync(lambda c: inspect(c).get_table_names()))
        for name in LEGACY_TABLES:
            if name in existing:
                n = (await conn.exec_driver_sql(f'SELECT COUNT(*) FROM "{name}"')).scalar()
                if n:
                    print(f"  kept legacy table {name}: it still has {n} row(s)")
                else:
                    await conn.exec_driver_sql(f'DROP TABLE "{name}"')
                    print(f"  dropped empty legacy table {name}")
    await create_all()  # new tables only
    async with engine.begin() as conn:
        missing = await conn.run_sync(_missing)
        for table, col in missing:
            ddl_type = col.type.compile(dialect=engine.dialect)
            default = ""
            if col.server_default is not None:
                default = " DEFAULT '" + str(col.server_default.arg).replace("'", "''") + "'"
            await conn.exec_driver_sql(f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {ddl_type}{default}')
            print(f"  added {table.name}.{col.name} ({ddl_type})")
    print("Database is up to date." if not missing else f"Added {len(missing)} column(s).")


if __name__ == "__main__":
    asyncio.run(main())
