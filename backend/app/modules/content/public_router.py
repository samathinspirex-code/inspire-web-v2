from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.content.models import Campaign, Course, Faq, Leader, News, Redirect, Testimonial
from app.modules.content.service import all_settings, to_dict
from app.modules.payments.pricing import DEFAULT_FEE_PLANS

router = APIRouter(prefix="/api/v1/public", tags=["public content"])


async def _published(db: AsyncSession, model, order=None, limit: int | None = None):
    q = select(model).where(model.status == "published").order_by(*(order or [model.sort_order, model.id]))
    if limit:
        q = q.limit(limit)
    return [to_dict(r) for r in (await db.execute(q)).scalars().all()]


@router.get("/bundle")
async def bundle(db: AsyncSession = Depends(get_db)):
    """Everything a website page needs in one call (cached by the frontend for 60-300s)."""
    settings = await all_settings(db)
    settings.pop("billing", None)  # finance settings stay private
    courses = await _published(db, Course)
    for c in courses:
        c.pop("source", None)
    return {
        "settings": settings,
        "fee_plans": {**DEFAULT_FEE_PLANS, **(settings.get("fee_plans") or {})},
        "courses": courses,
        "testimonials": await _published(db, Testimonial),
        "leaders": await _published(db, Leader),
        "faqs": await _published(db, Faq),
        "campaigns": await _published(db, Campaign),
        "news": await _published(db, News, order=[News.published_at.desc()], limit=6),
    }


@router.get("/courses/{slug}")
async def course(slug: str, db: AsyncSession = Depends(get_db)):
    row = (await db.execute(select(Course).where(Course.slug == slug, Course.status == "published"))).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Course not found")
    return to_dict(row)


@router.get("/news")
async def news_list(db: AsyncSession = Depends(get_db)):
    return await _published(db, News, order=[News.published_at.desc()])


@router.get("/news/{slug}")
async def news_item(slug: str, db: AsyncSession = Depends(get_db)):
    row = (await db.execute(select(News).where(News.slug == slug, News.status == "published"))).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "News item not found")
    return to_dict(row)


@router.get("/redirects")
async def redirects(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Redirect))).scalars().all()
    return [{"source": r.source, "destination": r.destination, "permanent": r.permanent, "gone": r.gone} for r in rows]
