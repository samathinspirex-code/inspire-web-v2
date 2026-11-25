"""Async SQLAlchemy engine. Works with SQLite (local) and Postgres/Supabase (server)."""
from collections.abc import AsyncIterator

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _normalise(url: str) -> str:
    # Supabase gives postgresql://... ; SQLAlchemy async needs the asyncpg driver.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]
    return url


_url = make_url(_normalise(settings.DATABASE_URL))
if settings.DATABASE_PASSWORD and _url.get_backend_name() == "postgresql":
    # Password kept on its own line in .env, so special characters need no URL-encoding.
    _url = _url.set(password=settings.DATABASE_PASSWORD)
# For logs and safety checks only (password hidden).
DATABASE_URL = _url.render_as_string(hide_password=True)

_connect_args: dict = {}
if _url.get_backend_name() == "postgresql":
    # Safe with Supabase's pgbouncer poolers (transaction mode has no prepared statements).
    _connect_args = {"statement_cache_size": 0}

engine = create_async_engine(_url, pool_pre_ping=True, connect_args=_connect_args)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


async def create_all() -> None:
    # Import every module's models so they register on Base.metadata.
    from app.modules.admin_auth import models as _a  # noqa: F401
    from app.modules.content import models as _c  # noqa: F401
    from app.modules.demo import models as _d  # noqa: F401
    from app.modules.leads import models as _l  # noqa: F401
    from app.modules.payments import models as _p  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
