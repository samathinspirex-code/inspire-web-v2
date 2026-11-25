"""/api/v1/admin/payments: the CMS Payments area (students & fees, invoices, slips, emails, settings). Admin login required."""
import csv
import io
from datetime import date, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.types import utcnow
from app.modules.admin_auth.router import current_admin
from app.modules.content.service import all_settings, put_settings, to_dict
from app.modules.payments import billing, mailer, payhere, templates
from app.modules.payments.jobs import run_billing
from app.modules.payments.models import Enrolment, GatewayEvent, Invoice, Message, Payment, Slip, Student

router = APIRouter(prefix="/api/v1/admin/payments", tags=["admin-payments"])


def _who(admin) -> str:
    return getattr(admin, "email", "") or "admin"


def _sandbox() -> bool:
    return settings.PAYHERE_MODE != "live" and settings.ENVIRONMENT != "production"


def _err(e: billing.BillingError):
    raise HTTPException(e.status, e.message) from e


def _inv(i: Invoice, as_of: date) -> dict:
    d = to_dict(i)
    d.update(balance=float(billing.balance(i)), label=billing.schedule_label(i), status_label=billing.status_label(i, as_of),
             pay_url=templates.pay_url(i.token))
    d.pop("token", None)
    return d


async def _get(db: AsyncSession, model, item_id: int):
    obj = await db.get(model, item_id)
    if not obj:
        raise HTTPException(404, "Not found")
    return obj


# ---------- overview ----------
@router.get("/overview")
async def overview(db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    t = billing.today()
    month_start = t.replace(day=1)
    collected = (await db.execute(select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.received_on >= month_start))).scalar_one()
    unpaid = (await db.execute(select(Invoice).where(Invoice.status.in_(billing.UNPAID)))).scalars().all()
    overdue = [i for i in unpaid if i.status == "open" and i.due_date < t]
    soon = sorted([i for i in unpaid if t <= i.due_date <= t + timedelta(days=14)], key=lambda i: i.due_date)[:20]
    students = {s.id: s for s in (await db.execute(select(Student).where(Student.id.in_({i.student_id for i in soon} or {0})))).scalars()}
    latest = (await db.execute(select(Payment, Student).join(Student, Student.id == Payment.student_id)
                               .order_by(Payment.created_at.desc()).limit(10))).all()
    return {
        "collected_month": float(collected or 0),
        "outstanding": float(sum((billing.balance(i) for i in unpaid if i.status == "open"), billing.D0)),
        "scheduled": float(sum((billing.balance(i) for i in unpaid if i.status == "scheduled"), billing.D0)),
        "overdue": float(sum((billing.balance(i) for i in overdue), billing.D0)), "overdue_count": len(overdue),
        "pending_slips": (await db.execute(select(func.count()).select_from(Slip).where(Slip.status == "pending"))).scalar_one(),
        "queued_emails": (await db.execute(select(func.count()).select_from(Message).where(Message.status == "queued"))).scalar_one(),
        "failed_emails": (await db.execute(select(func.count()).select_from(Message).where(Message.status == "failed"))).scalar_one(),
        "mail_enabled": settings.MAIL_ENABLED, "mail_test_to": bool(settings.MAIL_TEST_TO),
        "payhere_mode": settings.PAYHERE_MODE, "payhere_ready": bool(settings.PAYHERE_MERCHANT_ID and settings.PAYHERE_MERCHANT_SECRET),
        "sandbox_tools": _sandbox(),
        "due_soon": [{**_inv(i, t), "student": students[i.student_id].name if i.student_id in students else ""} for i in soon],
        "latest_payments": [{**to_dict(p), "student": s.name, "student_id": s.id} for p, s in latest],
    }


# ---------- students & fees ----------
@router.get("/students")
async def students(state: str = "", q: str = "", db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    query = select(Enrolment, Student).join(Student, Student.id == Enrolment.student_id).order_by(Enrolment.created_at.desc()).limit(1000)
    if q:
        like = f"%{q.strip().lower()}%"
        query = query.where(or_(func.lower(Student.name).like(like), Student.email.like(like), Student.phone.like(like),
                                func.lower(Student.student_no).like(like), func.lower(Enrolment.course_title).like(like)))
    out = []
    for enr, st in (await db.execute(query)).all():
        s = await billing.enrolment_summary(db, enr)
        if state and s["state"] != state:
            continue
        out.append({**s, "student_id": st.id, "student_no": st.student_no, "name": st.name, "email": st.email, "phone": st.phone})
    return out


@router.get("/students/{student_id}")
async def student_detail(student_id: int, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    st = await _get(db, Student, student_id)
    t = billing.today()
    enrols = (await db.execute(select(Enrolment).where(Enrolment.student_id == st.id).order_by(Enrolment.created_at.desc()))).scalars().all()
    out_en = []
    for e in enrols:
        invs = (await db.execute(select(Invoice).where(Invoice.enrolment_id == e.id))).scalars().all()
        invs = sorted(invs, key=lambda i: (i.year, 0 if i.kind in ("registration", "full") else 1, i.due_date, i.seq or 0))
        out_en.append({"summary": await billing.enrolment_summary(db, e, t), "extra": e.extra or {}, "invoices": [_inv(i, t) for i in invs]})
    loose = (await db.execute(select(Invoice).where(Invoice.student_id == st.id, Invoice.enrolment_id.is_(None)))).scalars().all()
    pays = (await db.execute(select(Payment).where(Payment.student_id == st.id).order_by(Payment.created_at.desc()))).scalars().all()
    slips = (await db.execute(select(Slip).where(Slip.student_id == st.id).order_by(Slip.created_at.desc()))).scalars().all()
    msgs = (await db.execute(select(Message).where(Message.student_id == st.id).order_by(Message.created_at.desc()).limit(50))).scalars().all()
    cfg = await billing.billing_settings(db)
    return {"student": to_dict(st), "enrolments": out_en, "other_invoices": [_inv(i, t) for i in loose],
            "payments": [to_dict(p) for p in pays], "slips": [to_dict(s) for s in slips],
            "messages": [{k: v for k, v in to_dict(m).items() if k not in ("html", "text")} for m in msgs],
            "year2_defaults": (cfg.get("year2") or {}).get("hnd", {})}


class StudentIn(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None


@router.put("/students/{student_id}")
async def update_student(student_id: int, body: StudentIn, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    """Fix contact details, e.g. add an email so invoices and reminders can be sent."""
    st = await _get(db, Student, student_id)
    if body.email is not None:
        email = body.email.strip().lower()
        if email and "@" not in email:
            raise HTTPException(422, "That email doesn't look right")
        st.email = email[:200]
    if body.name is not None and len(body.name.strip()) >= 2:
        st.name = body.name.strip()[:200]
    if body.phone is not None:
        st.phone = body.phone.strip()[:60]
    await db.commit()
    return to_dict(st)


class PlanIn(BaseModel):
    code: str = "monthly"          # monthly | full
    first_due: date
    instalments: int = 0
    amount: float = 0


@router.post("/enrolments/{enr_id}/plan")
async def set_plan(enr_id: int, body: PlanIn, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    enr = await _get(db, Enrolment, enr_id)
    try:
        rows = await billing.set_plan(db, enr, code=body.code, first_due=body.first_due, instalments=body.instalments, amount=body.amount)
    except billing.BillingError as e:
        _err(e)
    await db.commit()
    return {"created": len(rows)}


class Year2In(BaseModel):
    first_due: date
    instalments: int
    amount: float


@router.post("/enrolments/{enr_id}/year2")
async def start_year2(enr_id: int, body: Year2In, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    enr = await _get(db, Enrolment, enr_id)
    try:
        rows = await billing.start_year2(db, enr, first_due=body.first_due, instalments=body.instalments, amount=body.amount)
    except billing.BillingError as e:
        _err(e)
    await db.commit()
    return {"created": len(rows)}


class ReasonIn(BaseModel):
    reason: str = ""


@router.post("/enrolments/{enr_id}/withdraw")
async def withdraw(enr_id: int, body: ReasonIn, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    enr = await _get(db, Enrolment, enr_id)
    n = await billing.withdraw(db, enr, body.reason)
    await db.commit()
    return {"cancelled": n}


class AutoIn(BaseModel):
    auto: bool


@router.put("/enrolments/{enr_id}/auto")
async def set_auto(enr_id: int, body: AutoIn, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    enr = await _get(db, Enrolment, enr_id)
    enr.auto = body.auto
    await db.commit()
    return {"auto": enr.auto}


# ---------- invoices ----------
@router.get("/invoices")
async def invoices(status: str = "", overdue: bool = False, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    t = billing.today()
    query = select(Invoice, Student).join(Student, Student.id == Invoice.student_id).order_by(Invoice.due_date.desc(), Invoice.id.desc()).limit(1000)
    if status:
        query = query.where(Invoice.status == status)
    if overdue:
        query = query.where(Invoice.status == "open", Invoice.due_date < t)
    return [{**_inv(i, t), "student": s.name, "student_no": s.student_no} for i, s in (await db.execute(query)).all()]


class InvoiceIn(BaseModel):
    student_id: int | None = None
    name: str = ""
    email: str = ""
    phone: str = ""
    enrolment_id: int | None = None
    description: str = Field(min_length=2, max_length=300)
    amount: float
    due_date: date
    send: bool = True


@router.post("/invoices")
async def create_invoice(body: InvoiceIn, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    """A one-off invoice + payment link (e.g. late fee, exam fee, custom amount)."""
    if body.amount <= 0:
        raise HTTPException(422, "Amount must be more than zero")
    if body.student_id:
        st = await _get(db, Student, body.student_id)
    else:
        if len(body.name.strip()) < 2 or "@" not in body.email:
            raise HTTPException(422, "Add the student's name and email")
        st = await billing.find_or_create_student(db, body.name, body.email, body.phone)
    enr = await db.get(Enrolment, body.enrolment_id) if body.enrolment_id else None
    if enr and enr.student_id != st.id:
        raise HTTPException(422, "That enrolment belongs to another student")
    t = billing.today()
    inv = await billing.new_invoice(db, student=st, enrolment=enr, kind="other", amount=body.amount, due=body.due_date,
                                    description=body.description, status="open", issue=t, year=enr.year if enr else 1)
    if body.send:
        await billing.queue_invoice_email(db, inv, st, dedupe=False)
    await db.commit()
    await mailer.flush(db)
    return _inv(inv, t)


@router.post("/invoices/{inv_id}/cancel")
async def cancel_invoice(inv_id: int, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    inv = await _get(db, Invoice, inv_id)
    if inv.status == "paid" or billing.dec(inv.amount_paid) > 0:
        raise HTTPException(409, "Invoices with payments can't be cancelled")
    inv.status = "cancelled"
    await db.commit()
    return {"ok": True}


@router.post("/invoices/{inv_id}/send")
async def send_invoice(inv_id: int, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    """Email (or re-email) the invoice with its payment link now. Scheduled invoices are opened early."""
    inv = await _get(db, Invoice, inv_id)
    if inv.status in ("paid", "cancelled"):
        raise HTTPException(409, "This invoice is " + inv.status)
    st = await db.get(Student, inv.student_id)
    if not st.email:
        raise HTTPException(409, "This student has no email address")
    if inv.status == "scheduled":
        inv.status, inv.issue_date = "open", billing.today()
    await billing.queue_invoice_email(db, inv, st, dedupe=False)
    await db.commit()
    res = await mailer.flush(db)
    return {"ok": True, "email": res, "mail_enabled": settings.MAIL_ENABLED}


class PaymentIn(BaseModel):
    amount: float
    method: str = "bank_transfer"   # bank_transfer | cash
    reference: str = ""
    received_on: date | None = None
    note: str = ""


@router.post("/invoices/{inv_id}/payments")
async def add_payment(inv_id: int, body: PaymentIn, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    if body.method not in ("bank_transfer", "cash"):
        raise HTTPException(422, "Card payments are recorded by PayHere automatically")
    inv = await _get(db, Invoice, inv_id)
    try:
        await billing.record_payment(db, inv, body.amount, body.method, reference=body.reference, note=body.note,
                                     received_on=body.received_on, recorded_by=_who(admin))
    except billing.BillingError as e:
        _err(e)
    await db.commit()
    await mailer.flush(db)
    return _inv(inv, billing.today())


@router.post("/invoices/{inv_id}/simulate")
async def simulate(inv_id: int, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    """Sandbox only: act as if PayHere confirmed a card payment for this invoice."""
    if not _sandbox():
        raise HTTPException(403, "Only available in sandbox")
    inv = await _get(db, Invoice, inv_id)
    if inv.status not in billing.UNPAID:
        raise HTTPException(409, "This invoice is " + inv.status)
    await payhere.simulate(db, inv)
    await db.commit()
    await mailer.flush(db)
    return _inv(inv, billing.today())


# ---------- slips ----------
@router.get("/slips")
async def slips(status: str = "pending", db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    query = (select(Slip, Invoice, Student).join(Invoice, Invoice.id == Slip.invoice_id).join(Student, Student.id == Slip.student_id)
             .order_by(Slip.created_at.desc()).limit(500))
    if status:
        query = query.where(Slip.status == status)
    t = billing.today()
    return [{**to_dict(s), "invoice": _inv(i, t), "student": st.name, "student_no": st.student_no, "student_id": st.id}
            for s, i, st in (await db.execute(query)).all()]


@router.get("/slips/{slip_id}/file")
async def slip_file(slip_id: int, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    slip = await _get(db, Slip, slip_id)
    root = Path(settings.SLIP_DIR).resolve()
    path = (root / slip.file_path).resolve()
    if root not in path.parents or not path.is_file():
        raise HTTPException(404, "File missing")
    return FileResponse(path, media_type=slip.mime, headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


class ApproveIn(BaseModel):
    amount: float | None = None
    note: str = ""


@router.post("/slips/{slip_id}/approve")
async def approve_slip(slip_id: int, body: ApproveIn, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    slip = await _get(db, Slip, slip_id)
    if slip.status != "pending":
        raise HTTPException(409, "This slip was already " + slip.status)
    inv = await db.get(Invoice, slip.invoice_id)
    amount = body.amount if body.amount else float(min(billing.dec(slip.amount), billing.balance(inv)) or slip.amount)
    try:
        await billing.record_payment(db, inv, amount, "bank_slip", reference=slip.reference or f"slip #{slip.id}",
                                     note=body.note, received_on=slip.paid_on, recorded_by=_who(admin))
    except billing.BillingError as e:
        _err(e)
    slip.status, slip.reviewed_by, slip.reviewed_at = "approved", _who(admin), utcnow()
    await db.commit()
    await mailer.flush(db)
    return {"ok": True}


@router.post("/slips/{slip_id}/reject")
async def reject_slip(slip_id: int, body: ReasonIn, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    slip = await _get(db, Slip, slip_id)
    if slip.status != "pending":
        raise HTTPException(409, "This slip was already " + slip.status)
    if len(body.reason.strip()) < 3:
        raise HTTPException(422, "Tell the student why, so they can fix it")
    slip.status, slip.reason, slip.reviewed_by, slip.reviewed_at = "rejected", body.reason.strip()[:500], _who(admin), utcnow()
    inv = await db.get(Invoice, slip.invoice_id)
    st = await db.get(Student, slip.student_id)
    subject, html, text = templates.slip_rejected(billing.first_name(st.name), await billing.inv_context(db, inv), slip.reason)
    await mailer.queue(db, kind="slip_rejected", to_email=st.email, to_name=st.name, subject=subject, html=html, text=text,
                       invoice_id=inv.id, student_id=st.id, dedupe_key=f"slip-rejected:{slip.id}")
    await db.commit()
    await mailer.flush(db)
    return {"ok": True}


# ---------- logs ----------
@router.get("/payments")
async def payments_log(db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    rows = (await db.execute(select(Payment, Invoice, Student).join(Invoice, Invoice.id == Payment.invoice_id)
                             .join(Student, Student.id == Payment.student_id).order_by(Payment.created_at.desc()).limit(1000))).all()
    return [{**to_dict(p), "invoice_number": i.number, "description": i.description, "student": s.name, "student_no": s.student_no}
            for p, i, s in rows]


@router.get("/gateway-events")
async def gateway_events(db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    rows = (await db.execute(select(GatewayEvent).order_by(GatewayEvent.created_at.desc()).limit(300))).scalars().all()
    return [to_dict(r) for r in rows]


@router.get("/messages")
async def messages(status: str = "", db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    query = select(Message).order_by(Message.created_at.desc()).limit(500)
    if status:
        query = query.where(Message.status == status)
    return [{k: v for k, v in to_dict(m).items() if k not in ("html", "text")} for m in (await db.execute(query)).scalars().all()]


@router.get("/messages/{msg_id}")
async def message(msg_id: int, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    return to_dict(await _get(db, Message, msg_id))


@router.post("/messages/{msg_id}/retry")
async def retry_message(msg_id: int, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    m = await _get(db, Message, msg_id)
    m.status, m.attempts, m.error, m.created_at = "queued", 0, "", utcnow()
    await db.commit()
    return await mailer.flush(db)


# ---------- settings & jobs ----------
@router.get("/settings")
async def get_billing_settings(db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    return await billing.billing_settings(db)


@router.put("/settings")
async def save_billing_settings(body: dict, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    cur = await billing.billing_settings(db)
    for k in ("invoice_lead_days", "remind_before_days", "remind_after_days"):
        if k in body:
            cur[k] = max(0, min(60, int(body[k] or 0)))
    for k in ("remind_on_due",):
        if k in body:
            cur[k] = bool(body[k])
    if "finance_email" in body:
        cur["finance_email"] = str(body["finance_email"] or "").strip()[:200]
    if isinstance(body.get("bank"), dict):
        cur["bank"] = {k: str(v)[:200] for k, v in body["bank"].items() if k in ("account_name", "bank", "branch", "account_no", "note")}
    if isinstance(body.get("year2"), dict):
        cur["year2"] = body["year2"]
    await put_settings(db, {"billing": cur})
    return cur


class RunIn(BaseModel):
    as_of: date | None = None


@router.post("/run-billing")
async def run_now(body: RunIn, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    """Run the billing job now. A future date (to test reminders) is allowed in sandbox only."""
    if body.as_of and body.as_of != billing.today() and not _sandbox():
        raise HTTPException(403, "Dates can only be changed in sandbox")
    return await run_billing(db, body.as_of)


# ---------- exports ----------
@router.get("/export/{kind}.csv")
async def export(kind: str, db: AsyncSession = Depends(get_db), admin=Depends(current_admin)):
    buf = io.StringIO()
    w = csv.writer(buf)
    if kind == "students":
        rows = await students("", "", db, admin)
        w.writerow(["Student no", "Name", "Email", "Phone", "Course", "Plan", "Year", "Status", "Instalments paid", "Instalments", "Paid (LKR)",
                    "Balance (LKR)", "Overdue (LKR)", "Days overdue", "Next due", "Next amount"])
        for r in rows:
            w.writerow([r["student_no"], r["name"], r["email"], r["phone"], r["course"], r["plan_label"], r["year"], r["state"],
                        r["instalments_paid"], r["instalments"], r["paid_total"], r["balance"], r["overdue_amount"], r["days_overdue"],
                        r["next_due"] or "", r["next_amount"]])
    elif kind == "payments":
        w.writerow(["Date", "Student no", "Student", "Invoice", "For", "Method", "Amount (LKR)", "Reference", "Recorded by"])
        for r in await payments_log(db, admin):
            w.writerow([r["received_on"], r["student_no"], r["student"], r["invoice_number"], r["description"], r["method"], r["amount"],
                        r["reference"], r["recorded_by"]])
    else:
        raise HTTPException(404, "Unknown export")
    return Response(buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{kind}-{billing.today()}.csv"'})
