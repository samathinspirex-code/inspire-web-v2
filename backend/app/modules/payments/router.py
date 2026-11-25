"""Public payment routes: enrol (order), the student's invoice page (/pay/{token}), card checkout, slip upload, PayHere notify."""
import time
import uuid
from collections import defaultdict, deque
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.modules.content.models import Course, SiteSetting
from app.modules.payments import billing, mailer, payhere, templates
from app.modules.payments.models import Enrolment, Invoice, Slip, Student
from app.modules.payments.pricing import addon_price, plans_for

router = APIRouter(tags=["payments"])

_hits: dict[str, deque] = defaultdict(deque)


def _limited(key: str, limit: int, window: int) -> bool:
    q, now = _hits[key], time.monotonic()
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= limit:
        return True
    q.append(now)
    return False


def _ip(request: Request) -> str:
    return (request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "?"))


class OrderIn(BaseModel):
    course_key: str
    plan: int = 0
    addons: list[str] = Field(default_factory=list)
    free: list[str] = Field(default_factory=list)
    method: str = "payhere"   # payhere | bank_transfer
    name: str
    phone: str
    email: str = ""
    extra: dict = Field(default_factory=dict)


def pay_url(token: str) -> str:
    return templates.pay_url(token)


@router.post("/api/v1/public/orders")
async def create_order(body: OrderIn, request: Request, db: AsyncSession = Depends(get_db)):
    """Enrol from the website. The server prices everything from the course's fee plan."""
    if _limited("order:" + _ip(request), 20, 600):
        raise HTTPException(429, "Too many attempts. Please wait a few minutes.")
    course = (await db.execute(select(Course).where(Course.key == body.course_key, Course.status == "published"))).scalar_one_or_none()
    if not course:
        raise HTTPException(404, "Programme not found")
    if len(body.name.strip()) < 2 or len("".join(c for c in body.phone if c.isdigit())) < 9:
        raise HTTPException(422, "Please add your full name and a WhatsApp number.")
    if body.method not in ("payhere", "bank_transfer"):
        raise HTTPException(422, "Unknown payment method")
    fee_plans = await db.get(SiteSetting, "fee_plans")
    plans = plans_for(course, fee_plans.value if fee_plans else None)
    plan = plans[min(max(body.plan, 0), len(plans) - 1)]
    addons = []
    if body.addons:
        rows = (await db.execute(select(Course).where(Course.key.in_(body.addons[:4]), Course.plan_type == "cpd"))).scalars().all()
        addons = [(c, addon_price(c)) for c in rows if c.key != course.key]
    student = await billing.find_or_create_student(db, body.name, body.email, body.phone)
    extra = {"free": body.free[:2], **{k: v for k, v in body.extra.items() if k in ("utm", "start", "who", "referral", "scholarship")}}
    enr, inv = await billing.start_enrolment(db, course=course, plan=plan, student=student, method=body.method, addons=addons, extra=extra)
    await db.commit()
    out = {"reference": inv.number if inv else enr.reference, "enrolment": enr.reference, "amount": float(inv.amount) if inv else 0,
           "status": "pending" if inv else enr.status, "checkout": None, "pay_url": pay_url(inv.token) if inv else None}
    await mailer.flush(db)   # bank transfer: send the invoice email right away (no-op while email is off)
    if inv and body.method == "payhere":
        try:
            out["checkout"] = await payhere.checkout(db, inv)
        except payhere.PayError as e:
            out["checkout_error"] = e.message
    return out


@router.get("/api/v1/public/orders/{reference}")
async def order_status(reference: str, db: AsyncSession = Depends(get_db)):
    inv = (await db.execute(select(Invoice).where(Invoice.number == reference))).scalar_one_or_none()
    if inv:
        return {"reference": inv.number, "status": "paid" if inv.status == "paid" else "pending", "amount": float(inv.amount),
                "description": inv.description, "pay_url": pay_url(inv.token)}
    enr = (await db.execute(select(Enrolment).where(Enrolment.reference == reference))).scalar_one_or_none()
    if not enr:
        raise HTTPException(404, "Order not found")
    return {"reference": enr.reference, "status": enr.status, "amount": 0, "description": enr.course_title}


# ---------- the student's invoice page ----------
async def _invoice(db: AsyncSession, token: str) -> Invoice:
    inv = (await db.execute(select(Invoice).where(Invoice.token == token))).scalar_one_or_none() if 16 <= len(token) <= 64 else None
    if not inv or inv.status == "cancelled":
        raise HTTPException(404, "This payment link is not valid. Please contact us.")
    return inv


@router.get("/api/v1/public/pay/{token}")
async def pay_view(token: str, db: AsyncSession = Depends(get_db)):
    inv = await _invoice(db, token)
    student = await db.get(Student, inv.student_id)
    enr = await db.get(Enrolment, inv.enrolment_id) if inv.enrolment_id else None
    cfg = await billing.billing_settings(db)
    pending = (await db.execute(select(Slip).where(Slip.invoice_id == inv.id).order_by(Slip.id.desc()))).scalars().first()
    summary = await billing.enrolment_summary(db, enr) if enr else None
    as_of = billing.today()
    return {
        "invoice": {"number": inv.number, "description": inv.description, "lines": inv.lines or [], "amount": float(inv.amount),
                    "paid": float(inv.amount_paid or 0), "balance": float(billing.balance(inv)), "due_date": inv.due_date,
                    "status": inv.status, "status_label": billing.status_label(inv, as_of)},
        "student": {"first_name": billing.first_name(student.name), "student_no": student.student_no},
        "course": enr.course_title if enr else "", "plan": enr.plan_label if enr else "",
        "schedule": await billing.schedule(db, enr, as_of),
        "summary": {k: summary[k] for k in ("instalments_paid", "instalments", "paid_total", "balance", "next_due", "next_amount")} if summary else None,
        "bank": cfg.get("bank") or {},
        "card_enabled": bool(settings.PAYHERE_MERCHANT_ID and settings.PAYHERE_MERCHANT_SECRET),
        "slip": {"status": pending.status, "reason": pending.reason, "uploaded": pending.created_at} if pending else None,
    }


@router.post("/api/v1/public/pay/{token}/checkout")
async def pay_checkout(token: str, request: Request, db: AsyncSession = Depends(get_db)):
    if _limited("checkout:" + _ip(request), 20, 600):
        raise HTTPException(429, "Too many attempts. Please wait a few minutes.")
    inv = await _invoice(db, token)
    try:
        return await payhere.checkout(db, inv)
    except payhere.PayError as e:
        raise HTTPException(e.status, e.message) from e


MAGIC = {b"\xff\xd8\xff": ("image/jpeg", ".jpg"), b"\x89PNG\r\n\x1a\n": ("image/png", ".png"), b"%PDF-": ("application/pdf", ".pdf")}


def _sniff(head: bytes) -> tuple[str, str] | None:
    for sig, kind in MAGIC.items():
        if head.startswith(sig):
            return kind
    return None


@router.post("/api/v1/public/pay/{token}/slip")
async def upload_slip(token: str, request: Request, file: UploadFile = File(...), amount: float = Form(...),
                      paid_on: date | None = Form(None), reference: str = Form(""), note: str = Form(""),
                      db: AsyncSession = Depends(get_db)):
    if _limited("slip:" + _ip(request), 8, 3600):
        raise HTTPException(429, "Too many uploads. Please try again later.")
    inv = await _invoice(db, token)
    if inv.status == "paid":
        raise HTTPException(409, "This invoice is already paid.")
    if amount <= 0 or amount > 10_000_000:
        raise HTTPException(422, "Please enter the amount you transferred.")
    waiting = (await db.execute(select(Slip.id).where(Slip.invoice_id == inv.id, Slip.status == "pending"))).all()
    if len(waiting) >= 3:
        raise HTTPException(409, "We already have slips waiting for review on this invoice.")
    data = await file.read(settings.SLIP_MAX_BYTES + 1)
    if len(data) > settings.SLIP_MAX_BYTES:
        raise HTTPException(413, "The file is too large (max 5 MB).")
    kind = _sniff(data[:16])
    if not kind:
        raise HTTPException(415, "Please upload a photo (JPG or PNG) or a PDF of your slip.")
    folder = Path(settings.SLIP_DIR) / date.today().strftime("%Y%m")
    folder.mkdir(parents=True, exist_ok=True)
    name = uuid.uuid4().hex + kind[1]
    (folder / name).write_bytes(data)
    student = await db.get(Student, inv.student_id)
    slip = Slip(invoice_id=inv.id, student_id=student.id, file_path=str((folder / name).relative_to(settings.SLIP_DIR)),
                file_name=(file.filename or name)[:200], mime=kind[0], size=len(data), amount=billing.dec(amount), paid_on=paid_on,
                reference=reference.strip()[:120], note=note.strip()[:500])
    db.add(slip)
    await db.flush()
    ctx = await billing.inv_context(db, inv)
    subject, html, text = templates.slip_received(billing.first_name(student.name), ctx)
    await mailer.queue(db, kind="slip_received", to_email=student.email, to_name=student.name, subject=subject, html=html, text=text,
                       invoice_id=inv.id, student_id=student.id, dedupe_key=f"slip-received:{slip.id}")
    finance = (await billing.billing_settings(db)).get("finance_email") or ""
    if finance:
        subject, html, text = templates.finance_slip_alert(student.name, ctx, amount, slip.reference)
        await mailer.queue(db, kind="finance_slip", to_email=finance, to_name="Finance", subject=subject, html=html, text=text,
                           invoice_id=inv.id, dedupe_key=f"slip-alert:{slip.id}")
    await db.commit()
    await mailer.flush(db)
    return {"ok": True, "status": "pending"}


@router.post("/api/v1/payments/payhere/notify", response_class=PlainTextResponse)
async def payhere_notify(request: Request, db: AsyncSession = Depends(get_db)):
    if int(request.headers.get("content-length") or 0) > 32_768:
        return PlainTextResponse("OK")
    form = await request.form()
    await payhere.notify(db, {k: v for k, v in form.items() if isinstance(v, str)})
    await mailer.flush(db)
    return "OK"  # PayHere only needs a 200
