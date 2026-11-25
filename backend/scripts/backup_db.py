"""Back up (or restore) every table of this site's own database to one gzipped JSON file.

  python scripts/backup_db.py                      -> backups/inspire-web-v2-YYYYmmdd-HHMMSS.json.gz
  python scripts/backup_db.py --restore FILE       -> load a backup into EMPTY tables
  python scripts/backup_db.py --restore FILE --replace   -> wipe the tables first, then load

Works without pg_dump. Backups hold leads, demo accounts and password hashes: keep them private
(backups/ is git-ignored). Only this project's tables are touched, never the current site's database.
"""
import argparse
import asyncio
import base64
import gzip
import json
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

import _bootstrap  # noqa: F401
from sqlalchemy import MetaData, delete, func, insert, select, text

from app.core.database import DATABASE_URL, Base, create_all, engine

BACKUP_DIR = Path(__file__).resolve().parents[1] / "backups"
CURRENT_DB_MARKERS = ("inspirecollege", "uqiejlukbrdfvmhuubpa")  # the current site's database: never restore into it


def _enc(v):
    if isinstance(v, datetime):
        return {"__dt": v.isoformat()}
    if isinstance(v, date):
        return {"__d": v.isoformat()}
    if isinstance(v, Decimal):
        return {"__dec": str(v)}
    if isinstance(v, (bytes, bytearray, memoryview)):
        return {"__b64": base64.b64encode(bytes(v)).decode()}
    raise TypeError(f"Cannot back up value of type {type(v).__name__}")


def _dec(o):
    if "__dt" in o:
        return datetime.fromisoformat(o["__dt"])
    if "__d" in o:
        return date.fromisoformat(o["__d"])
    if "__dec" in o:
        return Decimal(o["__dec"])
    if "__b64" in o:
        return base64.b64decode(o["__b64"])
    return o


def _tables():
    return list(Base.metadata.sorted_tables)  # parents before children


async def backup() -> Path:
    # Import the models so every table is known (read-only: nothing is created during a backup).
    from app.modules.admin_auth import models as _a  # noqa: F401
    from app.modules.content import models as _c  # noqa: F401
    from app.modules.demo import models as _d  # noqa: F401
    from app.modules.leads import models as _l  # noqa: F401
    from app.modules.payments import models as _p  # noqa: F401

    out = {"created_at": datetime.now(timezone.utc).isoformat(), "database": DATABASE_URL, "tables": {}}
    # Back up what is really in the database (reflected), so it works before AND after a schema upgrade
    # and also keeps tables the current code no longer defines.
    async with engine.connect() as conn:
        live = MetaData()
        await conn.run_sync(lambda c: live.reflect(bind=c))
        for t in live.sorted_tables:
            rows = (await conn.execute(select(t))).mappings().all()
            out["tables"][t.name] = [dict(r) for r in rows]
    BACKUP_DIR.mkdir(exist_ok=True)
    path = BACKUP_DIR / f"inspire-web-v2-{datetime.now():%Y%m%d-%H%M%S}.json.gz"
    with gzip.open(path, "wt", encoding="utf-8") as f:
        json.dump(out, f, default=_enc, ensure_ascii=False)
    for name, rows in out["tables"].items():
        print(f"  {name:22} {len(rows):6} rows")
    print("Saved", path, f"({path.stat().st_size // 1024} KB)")
    return path


async def restore(path: Path, replace: bool) -> None:
    if any(m in DATABASE_URL for m in CURRENT_DB_MARKERS):
        raise SystemExit("Refusing: DATABASE_URL points at the current site's database.")
    from app.modules.admin_auth import models as _a  # noqa: F401
    from app.modules.content import models as _c  # noqa: F401
    from app.modules.demo import models as _d  # noqa: F401
    from app.modules.leads import models as _l  # noqa: F401
    from app.modules.payments import models as _p  # noqa: F401

    with gzip.open(path, "rt", encoding="utf-8") as f:
        data = json.load(f, object_hook=_dec)
    await create_all()
    tables = _tables()
    async with engine.begin() as conn:
        if not replace:
            for t in tables:
                n = (await conn.execute(select(func.count()).select_from(t))).scalar_one()
                if n:
                    raise SystemExit(f"Table {t.name} already has {n} rows. Use --replace to wipe and restore.")
        else:
            for t in reversed(tables):
                await conn.execute(delete(t))
        for t in tables:
            rows = data["tables"].get(t.name) or []
            cols = {c.name for c in t.columns}
            rows = [{k: v for k, v in r.items() if k in cols} for r in rows]
            if rows:
                await conn.execute(insert(t), rows)
            print(f"  {t.name:22} {len(rows):6} rows")
        if engine.dialect.name == "postgresql":  # move id sequences past the restored ids
            for t in tables:
                for c in t.primary_key.columns:
                    if c.autoincrement is True or (c.autoincrement == "auto" and c.type.python_type is int):
                        await conn.execute(text(
                            f"SELECT setval(pg_get_serial_sequence('{t.name}', '{c.name}'), "
                            f"COALESCE((SELECT MAX({c.name}) FROM {t.name}), 0) + 1, false) "
                            f"WHERE pg_get_serial_sequence('{t.name}', '{c.name}') IS NOT NULL"))
    print("Restored from", path)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--restore", type=Path)
    ap.add_argument("--replace", action="store_true")
    a = ap.parse_args()
    asyncio.run(restore(a.restore, a.replace) if a.restore else backup())
