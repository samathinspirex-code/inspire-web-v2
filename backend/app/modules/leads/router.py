import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.leads.models import Lead

router = APIRouter(prefix="/api/v1/public", tags=["leads"])

KINDS = {"enrol", "contact", "aptitude", "admissions", "callback"}
_hits: dict[str, deque] = defaultdict(deque)


def _rate_limited(ip: str, limit: int = 10, window: int = 600) -> bool:
    q, now = _hits[ip], time.monotonic()
    while q and now - q[0] > window:
        q.popleft()
    q.append(now)
    return len(q) > limit


class LeadIn(BaseModel):
    kind: str
    name: str = ""
    email: str = ""
    phone: str = ""
    course_key: str = ""
    message: str = ""
    data: dict = Field(default_factory=dict)


@router.post("/leads")
async def create_lead(body: LeadIn, request: Request, db: AsyncSession = Depends(get_db)):
    if body.kind not in KINDS:
        raise HTTPException(422, "Unknown form")
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0].strip()
    if _rate_limited(ip):
        raise HTTPException(429, "Too many submissions. Please try again later.")
    if not (body.email.strip() or body.phone.strip()):
        raise HTTPException(422, "Please add an email or phone number.")
    lead = Lead(kind=body.kind, name=body.name[:200], email=body.email[:200], phone=body.phone[:60], course_key=body.course_key[:120], message=body.message[:5000], data=body.data)
    db.add(lead)
    await db.commit()
    return {"ok": True, "id": lead.id}
