"""Tests run against a throwaway SQLite file, never the real database."""
import os
import sys
import tempfile
from pathlib import Path

_tmp = Path(tempfile.mkdtemp(prefix="inspire-web-v2-test-"))
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///" + (_tmp / "test.db").as_posix()
os.environ["MEDIA_DIR"] = str(_tmp / "media")
os.environ["JWT_SECRET"] = "test-secret-" + "x" * 40
os.environ["PAYHERE_MODE"] = "sandbox"
os.environ["PAYHERE_MERCHANT_ID"] = "1211149"
os.environ["PAYHERE_MERCHANT_SECRET"] = "test-merchant-secret"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from sqlalchemy import event  # noqa: E402

from app.core.database import SessionLocal, create_all, engine  # noqa: E402


@event.listens_for(engine.sync_engine, "connect")
def _fk_on(dbapi_conn, _):  # enforce foreign keys like Postgres does
    dbapi_conn.cursor().execute("PRAGMA foreign_keys=ON")
from app.main import app  # noqa: E402
from app.modules.content.models import Course  # noqa: E402


@pytest_asyncio.fixture(scope="session", autouse=True)
async def schema():
    await create_all()
    async with SessionLocal() as db:
        db.add(Course(key="hnd-se", slug="hnd-se-test", title="HND Software Engineering", short="HND · SE", level="HND", plan_type="hnd",
                      fee=280000, fee_label="from LKR 280,000", status="published", detail={}, source={}))
        db.add(Course(key="c-aimastery", slug="ai-mastery-test", title="AI Mastery", short="AI Mastery", level="Short course", plan_type="cpd",
                      fee=75000, cpd_addon_fee=75000, status="published", detail={}, source={}))
        await db.commit()
    yield


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
def anyio_backend():
    return "asyncio"
