import re
import uuid
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import check_password, hash_password, make_token
from app.core.types import utcnow
from app.modules.demo.models import DemoEvent, DemoState, DemoUser
from app.modules.leads.models import Lead

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
# Names are later shown inside the portal; keep them to plain name characters.
NAME_BAD = re.compile(r"[^A-Za-zÀ-ɏ .\-]")
MAX_STATE_BYTES = 600_000


class DemoError(Exception):
    def __init__(self, status: int, message: str):
        self.status, self.message = status, message


def clean_name(raw: str) -> str:
    return re.sub(r"\s+", " ", NAME_BAD.sub("", raw or "")).strip()[:80]


def token_for(user: DemoUser) -> str:
    return make_token(user.id, "demo", user.expires_at)


async def signup(db: AsyncSession, *, name: str, email: str, phone: str, interest: str, password: str, utm: dict | None = None) -> DemoUser:
    name, email = clean_name(name), (email or "").strip().lower()
    digits = re.sub(r"\D", "", phone or "")
    if len(name) < 2 or not EMAIL_RE.match(email) or len(digits) < 9 or len(password or "") < 6:
        raise DemoError(422, "Please add your name, a valid email, a mobile number and a password of at least 6 characters.")
    existing = (await db.execute(select(DemoUser).where(DemoUser.email == email))).scalar_one_or_none()
    if existing:
        if existing.expires_at > utcnow():
            raise DemoError(409, "This email already has a demo account. Log in instead.")
        await purge_user(db, existing.id)
    now = utcnow()
    user = DemoUser(
        id=str(uuid.uuid4()), email=email, full_name=name, phone=phone.strip()[:40], interest=(interest or "")[:80],
        password_hash=hash_password(password), created_at=now, expires_at=now + timedelta(hours=settings.DEMO_TTL_HOURS),
    )
    db.add(user)
    await db.flush()  # the account row must exist before rows that reference it (Postgres enforces this)
    db.add(DemoState(user_id=user.id, state=None))
    db.add(Lead(kind="demo", name=name, email=email, phone=user.phone, data={"interest": user.interest, "utm": utm or {}}))
    await db.commit()
    return user


async def login(db: AsyncSession, email: str, password: str) -> DemoUser:
    user = (await db.execute(select(DemoUser).where(DemoUser.email == (email or "").strip().lower()))).scalar_one_or_none()
    if not user or user.expires_at <= utcnow() or not check_password(password or "", user.password_hash):
        raise DemoError(401, "That email and password don't match an active demo account.")
    return user


async def get_active(db: AsyncSession, user_id: str) -> DemoUser | None:
    user = await db.get(DemoUser, user_id)
    if not user or user.expires_at <= utcnow():
        return None
    return user


def _ledger(state: dict | None) -> list:
    led = (state or {}).get("ledger")
    return led if isinstance(led, list) else []


async def save_state(db: AsyncSession, user: DemoUser, state: dict, raw_size: int) -> int:
    """Store the portal state; any new points-ledger lines become Live Campus events."""
    if raw_size > MAX_STATE_BYTES:
        raise DemoError(413, "Demo data is too large.")
    row = await db.get(DemoState, user.id)
    if row is None:
        row = DemoState(user_id=user.id, state=None)
        db.add(row)
    before = {(e.get("d"), e.get("t"), e.get("p")) for e in _ledger(row.state) if isinstance(e, dict)}
    new_events = 0
    for e in _ledger(state):
        if not isinstance(e, dict):
            continue
        sig = (e.get("d"), e.get("t"), e.get("p"))
        if sig in before or row.state is None:  # first save is the seed data, not activity
            continue
        try:
            pts = int(e.get("p") or 0)
        except (TypeError, ValueError):
            pts = 0
        if pts > 0:
            db.add(DemoEvent(user_id=user.id, label=str(e.get("t") or "Activity")[:200], points=min(pts, 100000)))
            new_events += 1
    row.state = state
    user.last_seen_at = utcnow()
    await db.commit()
    return new_events


async def purge_user(db: AsyncSession, user_id: str) -> None:
    # Explicit child deletes so it also works where FK cascades are off (SQLite).
    await db.execute(delete(DemoEvent).where(DemoEvent.user_id == user_id))
    await db.execute(delete(DemoState).where(DemoState.user_id == user_id))
    await db.execute(delete(DemoUser).where(DemoUser.id == user_id))


async def purge_expired(db: AsyncSession) -> int:
    ids = (await db.execute(select(DemoUser.id).where(DemoUser.expires_at <= utcnow()))).scalars().all()
    for uid in ids:
        await purge_user(db, uid)
    await db.commit()
    return len(ids)
