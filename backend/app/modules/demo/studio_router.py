"""/api/v1/admin/demo-classes/...: class content editor for the website CMS, modelled on the current LMS Course Studio
(sections → learning items, ↑/↓ reordering, draft/published). Admin login required."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.admin_auth.router import current_admin
from app.modules.demo.models import DemoClass, DemoClassItem, DemoClassSection

router = APIRouter(prefix="/api/v1/admin/demo-classes", tags=["admin-demo-classes"], dependencies=[Depends(current_admin)])

ITEM_TYPES = {"video", "pdf", "pptx", "text", "link", "assignment", "quiz"}


def section_dict(s: DemoClassSection, items: list[DemoClassItem]) -> dict:
    return {"id": s.id, "title": s.title, "description": s.description, "status": s.status, "position": s.position,
            "items": [item_dict(i) for i in items]}


def item_dict(i: DemoClassItem) -> dict:
    return {"id": i.id, "item_type": i.item_type, "title": i.title, "description": i.description, "resource_url": i.resource_url,
            "text_content": i.text_content, "duration_minutes": i.duration_minutes, "status": i.status,
            "is_required": i.is_required, "position": i.position}


async def class_tree(db: AsyncSession, class_id: int, published_only: bool = False) -> list[dict]:
    q = select(DemoClassSection).where(DemoClassSection.class_id == class_id)
    if published_only:
        q = q.where(DemoClassSection.status == "active")
    sections = (await db.execute(q.order_by(DemoClassSection.position, DemoClassSection.id))).scalars().all()
    if not sections:
        return []
    iq = select(DemoClassItem).where(DemoClassItem.section_id.in_([s.id for s in sections]))
    if published_only:
        iq = iq.where(DemoClassItem.status == "published")
    items = (await db.execute(iq.order_by(DemoClassItem.position, DemoClassItem.id))).scalars().all()
    by: dict[int, list] = {}
    for i in items:
        by.setdefault(i.section_id, []).append(i)
    return [section_dict(s, by.get(s.id, [])) for s in sections]


async def _class(db: AsyncSession, class_id: int) -> DemoClass:
    c = await db.get(DemoClass, class_id)
    if not c:
        raise HTTPException(404, "Class not found")
    return c


async def _section(db: AsyncSession, section_id: int) -> DemoClassSection:
    s = await db.get(DemoClassSection, section_id)
    if not s:
        raise HTTPException(404, "Section not found")
    return s


async def _item(db: AsyncSession, item_id: int) -> DemoClassItem:
    i = await db.get(DemoClassItem, item_id)
    if not i:
        raise HTTPException(404, "Learning item not found")
    return i


@router.get("/{class_id}/studio")
async def studio(class_id: int, db: AsyncSession = Depends(get_db)):
    c = await _class(db, class_id)
    return {"class": {"id": c.id, "code": c.code, "title": c.title, "programme": c.programme, "study_mode": c.study_mode,
                      "image": c.image, "status": c.status},
            "sections": await class_tree(db, class_id)}


class SectionIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    status: str = "active"


@router.post("/{class_id}/sections")
async def add_section(class_id: int, body: SectionIn, db: AsyncSession = Depends(get_db)):
    await _class(db, class_id)
    pos = (await db.execute(select(func.coalesce(func.max(DemoClassSection.position), 0)).where(DemoClassSection.class_id == class_id))).scalar_one()
    s = DemoClassSection(class_id=class_id, title=body.title.strip(), description=body.description,
                         status="draft" if body.status == "draft" else "active", position=pos + 1)
    db.add(s)
    await db.commit()
    return section_dict(s, [])


@router.put("/sections/{section_id}")
async def edit_section(section_id: int, body: SectionIn, db: AsyncSession = Depends(get_db)):
    s = await _section(db, section_id)
    s.title, s.description, s.status = body.title.strip(), body.description, "draft" if body.status == "draft" else "active"
    await db.commit()
    return {"ok": True}


@router.delete("/sections/{section_id}")
async def delete_section(section_id: int, db: AsyncSession = Depends(get_db)):
    s = await _section(db, section_id)
    await db.execute(delete(DemoClassItem).where(DemoClassItem.section_id == s.id))
    await db.delete(s)
    await db.commit()
    return {"ok": True}


class ReorderIn(BaseModel):
    ids: list[int]


@router.put("/{class_id}/sections/reorder")
async def reorder_sections(class_id: int, body: ReorderIn, db: AsyncSession = Depends(get_db)):
    rows = {s.id: s for s in (await db.execute(select(DemoClassSection).where(DemoClassSection.class_id == class_id))).scalars()}
    for pos, sid in enumerate(body.ids, start=1):
        if sid in rows:
            rows[sid].position = pos
    await db.commit()
    return {"ok": True}


class ItemIn(BaseModel):
    item_type: str = "video"
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    resource_url: str = ""
    text_content: str = ""
    duration_minutes: int | None = None
    status: str = "published"
    is_required: bool = False


def _apply_item(i: DemoClassItem, body: ItemIn) -> None:
    if body.item_type not in ITEM_TYPES:
        raise HTTPException(422, "Unknown content type")
    i.item_type, i.title, i.description = body.item_type, body.title.strip(), body.description
    i.resource_url, i.text_content = body.resource_url.strip()[:800], body.text_content
    i.duration_minutes = body.duration_minutes if body.duration_minutes and body.duration_minutes > 0 else None
    i.status = "draft" if body.status == "draft" else "published"
    i.is_required = bool(body.is_required)


@router.post("/sections/{section_id}/items")
async def add_item(section_id: int, body: ItemIn, db: AsyncSession = Depends(get_db)):
    await _section(db, section_id)
    pos = (await db.execute(select(func.coalesce(func.max(DemoClassItem.position), 0)).where(DemoClassItem.section_id == section_id))).scalar_one()
    i = DemoClassItem(section_id=section_id, position=pos + 1, title=body.title)
    _apply_item(i, body)
    db.add(i)
    await db.commit()
    return item_dict(i)


@router.put("/items/{item_id}")
async def edit_item(item_id: int, body: ItemIn, db: AsyncSession = Depends(get_db)):
    i = await _item(db, item_id)
    _apply_item(i, body)
    await db.commit()
    return item_dict(i)


@router.delete("/items/{item_id}")
async def delete_item(item_id: int, db: AsyncSession = Depends(get_db)):
    i = await _item(db, item_id)
    await db.delete(i)
    await db.commit()
    return {"ok": True}


@router.put("/sections/{section_id}/items/reorder")
async def reorder_items(section_id: int, body: ReorderIn, db: AsyncSession = Depends(get_db)):
    rows = {i.id: i for i in (await db.execute(select(DemoClassItem).where(DemoClassItem.section_id == section_id))).scalars()}
    for pos, iid in enumerate(body.ids, start=1):
        if iid in rows:
            rows[iid].position = pos
    await db.commit()
    return {"ok": True}
