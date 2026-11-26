"""/admin API: everything the website CMS can change. All routes need an admin token."""
import re
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import Date, func, inspect, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.types import utcnow
from app.modules.admin_auth.router import current_admin
from app.modules.content.models import Campaign, Course, Faq, Leader, Media, News, Redirect, Testimonial
from app.modules.content.service import all_settings, put_settings, to_dict
from app.modules.demo.models import DemoClass, DemoEvent, DemoUser
from app.modules.demo.service import purge_user
from app.modules.leads.models import Lead
from app.modules.payments.models import Enrolment, Invoice, Slip

router = APIRouter(prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(current_admin)])

RESOURCES = {
    "courses": Course, "testimonials": Testimonial, "leaders": Leader, "faqs": Faq,
    "campaigns": Campaign, "news": News, "redirects": Redirect, "demo_classes": DemoClass,
}
READ_ONLY = {"id", "updated_at", "created_at"}


def _model(name: str):
    m = RESOURCES.get(name)
    if not m:
        raise HTTPException(404, "Unknown section")
    return m


def _apply(obj, data: dict) -> None:
    cols = {c.key: c for c in inspect(type(obj)).column_attrs}
    for k, v in data.items():
        if k in cols and k not in READ_ONLY:
            if k == "published_at" and isinstance(v, str) and v:
                v = datetime.fromisoformat(v.replace("Z", "+00:00"))
            elif isinstance(cols[k].columns[0].type, Date) and isinstance(v, str):
                v = date.fromisoformat(v[:10]) if v else None
            setattr(obj, k, v)


def _order_cols(model):
    cols = [model.sort_order] if hasattr(model, "sort_order") else []
    return cols + [model.id]


# ---------- settings ----------
@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_db)):
    return await all_settings(db)


@router.put("/settings")
async def save_settings(patch: dict, db: AsyncSession = Depends(get_db)):
    return await put_settings(db, patch)


# ---------- generic content sections ----------
@router.get("/content/{name}")
async def list_items(name: str, db: AsyncSession = Depends(get_db)):
    model = _model(name)
    rows = (await db.execute(select(model).order_by(*_order_cols(model)))).scalars().all()
    return [to_dict(r) for r in rows]


@router.get("/content/{name}/{item_id}")
async def get_item(name: str, item_id: int, db: AsyncSession = Depends(get_db)):
    obj = await db.get(_model(name), item_id)
    if not obj:
        raise HTTPException(404, "Not found")
    return to_dict(obj)


@router.post("/content/{name}")
async def create_item(name: str, data: dict, db: AsyncSession = Depends(get_db)):
    model = _model(name)
    obj = model()
    if model is Course:
        data.setdefault("key", data.get("slug") or "")
        data.setdefault("detail", {})
        data.setdefault("source", {})
    if model is News:
        data.setdefault("source", {})
    _apply(obj, data)
    db.add(obj)
    try:
        await db.commit()
    except Exception as e:  # unique slug/key etc.
        await db.rollback()
        raise HTTPException(409, "Could not save: " + str(e.__class__.__name__)) from e
    return to_dict(obj)


@router.put("/content/{name}/{item_id}")
async def update_item(name: str, item_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    obj = await db.get(_model(name), item_id)
    if not obj:
        raise HTTPException(404, "Not found")
    _apply(obj, data)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(409, "Could not save: " + str(e.__class__.__name__)) from e
    return to_dict(obj)


@router.delete("/content/{name}/{item_id}")
async def delete_item(name: str, item_id: int, db: AsyncSession = Depends(get_db)):
    obj = await db.get(_model(name), item_id)
    if obj:
        await db.delete(obj)
        await db.commit()
    return {"ok": True}


# ---------- media ----------
ALLOWED_MEDIA = {"image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "video/mp4", "application/pdf"}


@router.get("/media")
async def list_media(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Media).order_by(Media.created_at.desc()))).scalars().all()
    return [to_dict(r) for r in rows]


@router.post("/media")
async def upload_media(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    if file.content_type not in ALLOWED_MEDIA:
        raise HTTPException(415, "Use an image, MP4 or PDF")
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(413, "Max 25 MB")
    safe = re.sub(r"[^A-Za-z0-9._-]", "-", file.filename or "file")[-80:]
    name = f"{uuid.uuid4().hex[:12]}-{safe}"
    folder = Path(settings.MEDIA_DIR)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / name).write_bytes(data)
    url = settings.PUBLIC_BASE_URL.rstrip("/") + settings.MEDIA_PUBLIC_PATH + "/" + name
    m = Media(filename=safe, url=url, content_type=file.content_type, size=len(data))
    db.add(m)
    await db.commit()
    return to_dict(m)


# ---------- leads ----------
@router.get("/leads")
async def list_leads(kind: str = "", db: AsyncSession = Depends(get_db)):
    q = select(Lead).order_by(Lead.created_at.desc()).limit(500)
    if kind:
        q = q.where(Lead.kind == kind)
    return [to_dict(r) for r in (await db.execute(q)).scalars().all()]


@router.put("/leads/{lead_id}")
async def update_lead(lead_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Not found")
    if "status" in data:
        lead.status = str(data["status"])[:20]
    await db.commit()
    return to_dict(lead)


# ---------- demo accounts ----------
@router.get("/demo-accounts")
async def demo_accounts(db: AsyncSession = Depends(get_db)):
    pts = select(DemoEvent.user_id, func.coalesce(func.sum(DemoEvent.points), 0).label("pts")).group_by(DemoEvent.user_id).subquery()
    rows = (await db.execute(select(DemoUser, pts.c.pts).outerjoin(pts, pts.c.user_id == DemoUser.id).order_by(DemoUser.created_at.desc()))).all()
    out = []
    for u, p in rows:
        d = to_dict(u)
        d.pop("password_hash", None)
        d["points_earned"] = int(p or 0)
        out.append(d)
    return out


@router.post("/demo-accounts/{user_id}/extend")
async def extend_demo(user_id: str, db: AsyncSession = Depends(get_db)):
    u = await db.get(DemoUser, user_id)
    if not u:
        raise HTTPException(404, "Not found")
    u.expires_at = max(u.expires_at, utcnow()) + timedelta(hours=settings.DEMO_TTL_HOURS)
    await db.commit()
    return {"expires_at": u.expires_at.isoformat()}


@router.delete("/demo-accounts/{user_id}")
async def delete_demo(user_id: str, db: AsyncSession = Depends(get_db)):
    await purge_user(db, user_id)
    await db.commit()
    return {"ok": True}


@router.get("/overview")
async def overview(db: AsyncSession = Depends(get_db)):
    async def count(model, *where):
        return (await db.execute(select(func.count()).select_from(model).where(*where))).scalar_one()
    return {
        "courses": await count(Course),
        "news": await count(News),
        "leads_new": await count(Lead, Lead.status == "new"),
        "enrolments_active": await count(Enrolment, Enrolment.status.in_(("active", "reserved"))),
        "invoices_open": await count(Invoice, Invoice.status == "open"),
        "slips_pending": await count(Slip, Slip.status == "pending"),
        "demo_active": await count(DemoUser, DemoUser.expires_at > utcnow()),
    }

