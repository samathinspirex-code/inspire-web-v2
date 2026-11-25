"""Live Campus feed: real activity from demo students, first name + initial only."""
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.types import utcnow
from app.modules.demo.models import DemoEvent, DemoUser

router = APIRouter(prefix="/api/v1/live", tags=["live"])


def _short(name: str) -> str:
    parts = (name or "Student").split()
    return parts[0] + (" " + parts[-1][0] + "." if len(parts) > 1 else "")


@router.get("/feed")
async def feed(db: AsyncSession = Depends(get_db)):
    now = utcnow()
    rows = (await db.execute(
        select(DemoEvent.label, DemoEvent.points, DemoEvent.created_at, DemoUser.full_name)
        .join(DemoUser, DemoUser.id == DemoEvent.user_id)
        .where(DemoEvent.created_at >= now - timedelta(hours=6))
        .order_by(DemoEvent.created_at.desc()).limit(20)
    )).all()
    active = (await db.execute(select(func.count()).select_from(DemoUser).where(DemoUser.last_seen_at >= now - timedelta(minutes=30)))).scalar_one()
    accounts = (await db.execute(select(func.count()).select_from(DemoUser).where(DemoUser.expires_at > now))).scalar_one()
    return {
        "now": now.isoformat(),
        "active_now": active,
        "demo_accounts": accounts,
        "events": [{"who": _short(r.full_name), "label": r.label, "points": r.points, "at": r.created_at.isoformat()} for r in rows],
    }
