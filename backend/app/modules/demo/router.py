import json
import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import read_token
from app.modules.demo import service
from sqlalchemy import select

from app.modules.demo.models import DemoClass, DemoState, DemoUser

router = APIRouter(prefix="/api/v1/demo", tags=["demo"])


class SignupIn(BaseModel):
    name: str
    email: str
    phone: str
    interest: str = ""
    password: str
    utm: dict | None = None


class LoginIn(BaseModel):
    email: str
    password: str


def _session(user: DemoUser) -> dict:
    return {
        "token": service.token_for(user),
        "expires_at": user.expires_at.isoformat(),
        "user": {"name": user.full_name, "email": user.email},
    }


async def current_demo_user(authorization: str = Header(default=""), db: AsyncSession = Depends(get_db)) -> DemoUser:
    token = authorization.removeprefix("Bearer ").strip()
    uid = read_token(token, "demo") if token else None
    user = await service.get_active(db, uid) if uid else None
    if not user:
        raise HTTPException(401, "Demo session expired. Please log in again.")
    return user


@router.post("/signup")
async def signup(body: SignupIn, db: AsyncSession = Depends(get_db)):
    try:
        user = await service.signup(db, name=body.name, email=body.email, phone=body.phone, interest=body.interest, password=body.password, utm=body.utm)
    except service.DemoError as e:
        raise HTTPException(e.status, e.message) from e
    return _session(user)


@router.post("/login")
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    try:
        user = await service.login(db, body.email, body.password)
    except service.DemoError as e:
        raise HTTPException(e.status, e.message) from e
    return _session(user)


_resets: dict[str, deque] = defaultdict(deque)


@router.post("/reset-password")
async def reset_password(body: LoginIn, request: Request, db: AsyncSession = Depends(get_db)):
    """Forgot password on a demo account: sets the new password and signs the student in."""
    ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "?"))
    q, now = _resets[ip], time.monotonic()
    while q and now - q[0] > 600:
        q.popleft()
    if len(q) >= 10:
        raise HTTPException(429, "Too many attempts. Please wait a few minutes.")
    q.append(now)
    try:
        user = await service.reset_password(db, body.email, body.password)
    except service.DemoError as e:
        raise HTTPException(e.status, e.message) from e
    return _session(user)


@router.get("/me")
async def me(user: DemoUser = Depends(current_demo_user), db: AsyncSession = Depends(get_db)):
    row = await db.get(DemoState, user.id)
    return {
        "user": {"name": user.full_name, "email": user.email, "phone": user.phone, "interest": user.interest},
        "expires_at": user.expires_at.isoformat(),
        "state": row.state if row else None,
        "classes": await published_classes(db),
    }


async def published_classes(db: AsyncSession) -> list[dict]:
    rows = (await db.execute(select(DemoClass).where(DemoClass.published == "published")
                             .order_by(DemoClass.sort_order, DemoClass.id))).scalars().all()
    return [{
        "id": c.id, "code": c.code, "title": c.title, "awarding_body": c.awarding_body, "school": c.school,
        "programme": c.programme, "intake": c.intake, "study_mode": c.study_mode,
        "start_date": c.start_date.isoformat() if c.start_date else None, "end_date": c.end_date.isoformat() if c.end_date else None,
        "lecturers": [x.strip() for x in (c.lecturers or "").split(",") if x.strip()], "status": c.status,
        "image": c.image, "description": c.description,
    } for c in rows]


@router.put("/state")
async def put_state(request: Request, user: DemoUser = Depends(current_demo_user), db: AsyncSession = Depends(get_db)):
    raw = await request.body()
    try:
        payload = json.loads(raw or b"{}")
    except ValueError as e:
        raise HTTPException(400, "Invalid JSON") from e
    state = payload.get("state") if isinstance(payload, dict) else None
    if not isinstance(state, dict):
        raise HTTPException(422, "state must be an object")
    try:
        events = await service.save_state(db, user, state, len(raw))
    except service.DemoError as e:
        raise HTTPException(e.status, e.message) from e
    return {"ok": True, "events": events}
