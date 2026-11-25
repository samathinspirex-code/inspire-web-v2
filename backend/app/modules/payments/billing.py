"""Instalment billing: enrol → first invoice → (paid) → monthly schedule → issue + remind → receipts.

Rules (agreed 2026-11-25):
- Monthly plans: the 1st instalment is due one month after the registration payment, then the same day each month
  (computed from that payment date, so 31 Jan → 28 Feb → 31 Mar).
- Only courses with "Automatic instalments" on get their schedule created automatically.
- HND Year 2 is started by finance (start_year2); reserved/advisor plans get their plan from finance (set_plan).
"""
import calendar
import secrets
import string
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.types import utcnow
from app.modules.content.models import Course
from app.modules.content.service import DEFAULT_SETTINGS, all_settings
from app.modules.payments import mailer, templates
from app.modules.payments.models import Enrolment, Invoice, Payment, Student
from app.modules.payments.pricing import billing_terms

SL_TZ = timezone(timedelta(hours=5, minutes=30))   # Sri Lanka, no daylight saving
UNPAID = ("scheduled", "open")
D0 = Decimal("0")


class BillingError(Exception):
    def __init__(self, status: int, message: str):
        self.status, self.message = status, message


# ---------- helpers ----------
def today() -> date:
    return datetime.now(SL_TZ).date()


def add_months(d: date, n: int) -> date:
    y, m = divmod(d.month - 1 + n, 12)
    y, m = d.year + y, m + 1
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def dec(v) -> Decimal:
    return Decimal(str(v or 0)).quantize(Decimal("0.01"))


def new_token() -> str:
    return secrets.token_urlsafe(24)


def new_reference() -> str:
    return "IC-" + "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))


def first_name(name: str) -> str:
    return (name or "there").strip().split(" ")[0] or "there"


async def billing_settings(db: AsyncSession) -> dict:
    s = (await all_settings(db)).get("billing") or {}
    return {**DEFAULT_SETTINGS["billing"], **s}


def balance(inv: Invoice) -> Decimal:
    return max(dec(inv.amount) - dec(inv.amount_paid), D0)


def short_title(enr: Enrolment | None) -> str:
    return (enr.course_title if enr else "") or "Inspire College"


# ---------- students ----------
async def find_or_create_student(db: AsyncSession, name: str, email: str, phone: str) -> Student:
    email = (email or "").strip().lower()[:200]
    phone = (phone or "").strip()[:60]
    st = None
    if email:
        st = (await db.execute(select(Student).where(Student.email == email).order_by(Student.id))).scalars().first()
    elif phone:
        st = (await db.execute(select(Student).where(Student.phone == phone, Student.email == "").order_by(Student.id))).scalars().first()
    if st:
        st.name = st.name or name.strip()[:200]
        st.phone = st.phone or phone
        return st
    st = Student(name=name.strip()[:200], email=email, phone=phone)
    db.add(st)
    await db.flush()
    st.student_no = f"S{1000 + st.id}"
    return st


# ---------- invoices ----------
async def new_invoice(db: AsyncSession, *, student: Student, enrolment: Enrolment | None, kind: str, amount, due: date,
                      description: str, status: str, seq: int | None = None, of: int | None = None, year: int = 1,
                      lines: list | None = None, issue: date | None = None) -> Invoice:
    inv = Invoice(token=new_token(), student_id=student.id, enrolment_id=enrolment.id if enrolment else None, kind=kind, year=year,
                  seq=seq, of=of, description=description[:300], lines=lines or [], amount=dec(amount), amount_paid=D0,
                  due_date=due, issue_date=issue, status=status, reminders=[])
    db.add(inv)
    await db.flush()
    inv.number = f"INV-{10000 + inv.id}"
    return inv


async def build_schedule(db: AsyncSession, enr: Enrolment, student: Student, *, anchor: date, first_offset: int, count: int,
                         amount, year: int) -> list[Invoice]:
    """Monthly instalment invoices, all created now as 'scheduled'; the job issues each one shortly before it is due."""
    out = []
    for i in range(1, count + 1):
        due = add_months(anchor, first_offset + i - 1)
        label = ("Year 2 · " if year == 2 else "") + f"Month {i} of {count}"
        out.append(await new_invoice(db, student=student, enrolment=enr, kind="instalment", amount=amount, due=due,
                                     description=f"{short_title(enr)} — {label}", status="scheduled", seq=i, of=count, year=year))
    return out


def schedule_label(inv: Invoice) -> str:
    if inv.kind == "instalment" and inv.seq:
        return ("Year 2 · " if inv.year == 2 else "") + f"Month {inv.seq} of {inv.of}"
    return {"registration": "Registration fee", "full": "Full payment"}.get(inv.kind, inv.description or "Payment")


def status_label(inv: Invoice, as_of: date) -> str:
    if inv.status == "paid":
        return "Paid"
    if inv.status == "open":
        return "Overdue" if inv.due_date < as_of else "Due"
    return "Upcoming"


async def enrolment_invoices(db: AsyncSession, enr: Enrolment) -> list[Invoice]:
    rows = (await db.execute(select(Invoice).where(Invoice.enrolment_id == enr.id, Invoice.status != "cancelled"))).scalars().all()
    order = {"registration": 0, "full": 0, "instalment": 1, "other": 2}
    return sorted(rows, key=lambda i: (i.year, order.get(i.kind, 3), i.due_date, i.seq or 0, i.id))


async def schedule(db: AsyncSession, enr: Enrolment | None, as_of: date | None = None) -> list[dict]:
    if not enr:
        return []
    as_of = as_of or today()
    return [{"number": i.number, "label": schedule_label(i), "due_date": i.due_date, "amount": float(i.amount),
             "paid": float(i.amount_paid or 0), "status": i.status, "status_label": status_label(i, as_of)}
            for i in await enrolment_invoices(db, enr)]


async def inv_context(db: AsyncSession, inv: Invoice) -> dict:
    enr = await db.get(Enrolment, inv.enrolment_id) if inv.enrolment_id else None
    return {"number": inv.number, "token": inv.token, "description": inv.description, "amount": float(inv.amount),
            "balance": float(balance(inv)), "due_date": inv.due_date, "course": short_title(enr)}


async def next_unpaid(db: AsyncSession, enr: Enrolment | None) -> Invoice | None:
    if not enr:
        return None
    return (await db.execute(select(Invoice).where(Invoice.enrolment_id == enr.id, Invoice.status.in_(UNPAID))
                             .order_by(Invoice.due_date, Invoice.id))).scalars().first()


# ---------- enrolment from the website ----------
async def start_enrolment(db: AsyncSession, *, course: Course, plan: dict, student: Student, method: str,
                          addons: list[tuple[Course, int]], extra: dict) -> tuple[Enrolment, Invoice | None]:
    terms = billing_terms(plan, course.plan_type)
    enr = Enrolment(
        reference=new_reference(), student_id=student.id, course_key=course.key, course_title=(course.short or course.title)[:300],
        plan_type=course.plan_type, plan_code=terms["code"], plan_label=terms["label"], year=1,
        registration_fee=dec(terms["today"] if terms["code"] != "full" else 0), instalments=terms["instalments"],
        instalment_amount=dec(terms["instalment_amount"]), auto=bool(course.auto_instalments), status="pending", method=method,
        extra={**extra, "addons": [{"key": c.key, "title": c.short or c.title, "price": p} for c, p in addons]},
    )
    db.add(enr)
    await db.flush()
    total = terms["today"] + sum(p for _, p in addons)
    if total <= 0:
        enr.status = "reserved"   # nothing to pay today (advisor plans, CPD seat holds)
        return enr, None
    kind = "full" if terms["code"] == "full" else "registration"
    head = "Full payment" if kind == "full" else "Registration fee"
    lines = [{"label": f"{course.short or course.title} — {terms['label'] or head}", "amount": terms["today"]}]
    lines += [{"label": f"{c.short or c.title} (add-on, 25% off)", "amount": p} for c, p in addons]
    d = today()
    inv = await new_invoice(db, student=student, enrolment=enr, kind=kind, amount=total, due=d, issue=d,
                            description=f"{enr.course_title} — {head}", status="open", lines=lines)
    inv.reminders = ["before", "due"]   # only the 'overdue' follow-up applies to the first invoice
    if method == "bank_transfer":
        await queue_invoice_email(db, inv, student, dedupe=True)
    return enr, inv


# ---------- payments ----------
async def record_payment(db: AsyncSession, inv: Invoice, amount, method: str, *, gateway_payment_id: str | None = None,
                         reference: str = "", note: str = "", received_on: date | None = None, recorded_by: str = "") -> Payment:
    amount = dec(amount)
    if amount <= 0:
        raise BillingError(422, "Amount must be more than zero")
    if inv.status == "cancelled":
        raise BillingError(409, "This invoice was cancelled")
    received_on = received_on or today()
    pay = Payment(invoice_id=inv.id, student_id=inv.student_id, amount=amount, method=method, gateway_payment_id=gateway_payment_id,
                  reference=reference[:120], note=note[:500], received_on=received_on, recorded_by=recorded_by[:200])
    db.add(pay)
    inv.amount_paid = dec(inv.amount_paid) + amount
    if inv.status == "scheduled":
        inv.status, inv.issue_date = "open", inv.issue_date or received_on
    became_paid = balance(inv) <= 0 and inv.status != "paid"
    if became_paid:
        inv.status, inv.paid_at = "paid", utcnow()
    await db.flush()
    enr = await db.get(Enrolment, inv.enrolment_id) if inv.enrolment_id else None
    student = await db.get(Student, inv.student_id)
    if became_paid and enr:
        await _after_paid(db, inv, enr, student, received_on)
    nxt = await next_unpaid(db, enr)
    ctx = await inv_context(db, inv)
    subject, html, text = templates.receipt(first_name(student.name), ctx, amount, method, await schedule(db, enr),
                                            {"amount": float(nxt.amount), "due_date": nxt.due_date} if nxt else None)
    await mailer.queue(db, kind="receipt", to_email=student.email, to_name=student.name, subject=subject, html=html, text=text,
                       invoice_id=inv.id, student_id=student.id, dedupe_key=f"receipt:{pay.id}")
    return pay


async def _after_paid(db: AsyncSession, inv: Invoice, enr: Enrolment, student: Student, paid_on: date) -> None:
    if enr.status == "pending" and inv.kind in ("registration", "full"):
        enr.start_date, enr.activated_at = paid_on, utcnow()
        enr.status = "reserved" if enr.plan_code == "reserve" else "active"
        if enr.plan_code == "monthly" and enr.auto and enr.instalments > 0 and dec(enr.instalment_amount) > 0:
            await build_schedule(db, enr, student, anchor=paid_on, first_offset=1, count=enr.instalments,
                                 amount=enr.instalment_amount, year=enr.year)
    await db.flush()
    if enr.status == "active":
        left = (await db.execute(select(func.count()).select_from(Invoice)
                                 .where(Invoice.enrolment_id == enr.id, Invoice.status.in_(UNPAID)))).scalar_one()
        # A monthly plan is complete only when all its months exist and are paid (not just because none were created yet).
        months_paid = (await db.execute(select(func.count()).select_from(Invoice).where(
            Invoice.enrolment_id == enr.id, Invoice.kind == "instalment", Invoice.year == enr.year, Invoice.status == "paid"))).scalar_one()
        if left == 0 and (enr.plan_code != "monthly" or (enr.instalments and months_paid >= enr.instalments)):
            enr.status = "completed"


# ---------- emails ----------
async def queue_invoice_email(db: AsyncSession, inv: Invoice, student: Student, dedupe: bool) -> None:
    subject, html, text = templates.invoice_issued(first_name(student.name), await inv_context(db, inv))
    await mailer.queue(db, kind="invoice", to_email=student.email, to_name=student.name, subject=subject, html=html, text=text,
                       invoice_id=inv.id, student_id=student.id, dedupe_key=f"issue:{inv.number}" if dedupe else None)


async def issue_due(db: AsyncSession, as_of: date, cfg: dict) -> int:
    """Open + email every scheduled instalment that falls due within the lead window."""
    limit = as_of + timedelta(days=int(cfg.get("invoice_lead_days", 5)))
    rows = (await db.execute(select(Invoice, Enrolment).join(Enrolment, Enrolment.id == Invoice.enrolment_id)
                             .where(Invoice.status == "scheduled", Invoice.due_date <= limit,
                                    Enrolment.status.in_(("active", "reserved"))))).all()
    for inv, _enr in rows:
        inv.status, inv.issue_date = "open", as_of
        await queue_invoice_email(db, inv, await db.get(Student, inv.student_id), dedupe=True)
    return len(rows)


def reminder_stage(due: date, as_of: date, cfg: dict) -> str | None:
    after = int(cfg.get("remind_after_days", 7))
    before = int(cfg.get("remind_before_days", 3))
    if as_of >= due + timedelta(days=after):
        return "after"
    if as_of >= due:
        return "due" if cfg.get("remind_on_due", True) else None
    if as_of >= due - timedelta(days=before):
        return "before"
    return None


async def send_reminders(db: AsyncSession, as_of: date, cfg: dict) -> int:
    rows = (await db.execute(select(Invoice).outerjoin(Enrolment, Enrolment.id == Invoice.enrolment_id)
                             .where(Invoice.status == "open", (Enrolment.id.is_(None)) | (Enrolment.status != "withdrawn")))).scalars().all()
    n = 0
    for inv in rows:
        stage = reminder_stage(inv.due_date, as_of, cfg)
        done = list(inv.reminders or [])
        if not stage or stage in done:
            continue
        student = await db.get(Student, inv.student_id)
        subject, html, text = templates.reminder(first_name(student.name), await inv_context(db, inv), stage)
        await mailer.queue(db, kind=f"reminder_{stage}", to_email=student.email, to_name=student.name, subject=subject, html=html,
                           text=text, invoice_id=inv.id, student_id=student.id, dedupe_key=f"remind:{inv.number}:{stage}")
        inv.reminders = done + [stage]
        inv.last_reminder_at = utcnow()
        n += 1
    return n


# ---------- finance actions (CMS) ----------
async def set_plan(db: AsyncSession, enr: Enrolment, *, code: str, first_due: date, instalments: int = 0, amount=0) -> list[Invoice]:
    """For reserved / advisor-plan enrolments: create the monthly schedule, or one invoice for the balance."""
    if enr.status not in ("reserved", "active"):
        raise BillingError(409, "Set a plan only for reserved or active enrolments")
    if (await db.execute(select(func.count()).select_from(Invoice).where(
            Invoice.enrolment_id == enr.id, Invoice.kind == "instalment", Invoice.year == enr.year, Invoice.status.in_(UNPAID)))).scalar_one():
        raise BillingError(409, "This enrolment already has unpaid instalments")
    student = await db.get(Student, enr.student_id)
    enr.status, enr.start_date = "active", enr.start_date or today()
    if code == "monthly":
        if instalments < 1 or dec(amount) <= 0:
            raise BillingError(422, "Add the number of months and the monthly amount")
        enr.plan_code, enr.instalments, enr.instalment_amount = "monthly", instalments, dec(amount)
        enr.plan_label = f"Monthly · {instalments} × LKR {int(dec(amount)):,}"
        return await build_schedule(db, enr, student, anchor=first_due, first_offset=0, count=instalments, amount=amount, year=enr.year)
    if dec(amount) <= 0:
        raise BillingError(422, "Add the amount")
    enr.plan_code, enr.plan_label = "full", "Pay in full"
    return [await new_invoice(db, student=student, enrolment=enr, kind="full", amount=amount, due=first_due,
                              description=f"{enr.course_title} — Full payment", status="scheduled", year=enr.year)]


async def start_year2(db: AsyncSession, enr: Enrolment, *, first_due: date, instalments: int, amount) -> list[Invoice]:
    if enr.plan_type != "hnd" or enr.year != 1:
        raise BillingError(409, "Year 2 can be started once, for HND enrolments")
    if enr.status in ("withdrawn", "pending"):
        raise BillingError(409, "This enrolment is " + enr.status)
    if instalments < 1 or dec(amount) <= 0:
        raise BillingError(422, "Add the number of months and the monthly amount")
    student = await db.get(Student, enr.student_id)
    enr.year, enr.status = 2, "active"
    enr.instalments, enr.instalment_amount, enr.plan_code = instalments, dec(amount), "monthly"
    enr.extra = {**(enr.extra or {}), "year2_started": today().isoformat()}
    return await build_schedule(db, enr, student, anchor=first_due, first_offset=0, count=instalments, amount=amount, year=2)


async def withdraw(db: AsyncSession, enr: Enrolment, reason: str) -> int:
    enr.status, enr.withdrawn_at = "withdrawn", utcnow()
    enr.extra = {**(enr.extra or {}), "withdraw_reason": reason[:300]}
    rows = (await db.execute(select(Invoice).where(Invoice.enrolment_id == enr.id, Invoice.status.in_(UNPAID)))).scalars().all()
    for inv in rows:
        if dec(inv.amount_paid) == 0:
            inv.status = "cancelled"
    return len(rows)


# ---------- summaries ----------
async def enrolment_summary(db: AsyncSession, enr: Enrolment, as_of: date | None = None) -> dict:
    as_of = as_of or today()
    invs = await enrolment_invoices(db, enr)
    inst = [i for i in invs if i.kind == "instalment" and i.year == enr.year]
    unpaid = [i for i in invs if i.status in UNPAID]
    overdue = [i for i in invs if i.status == "open" and i.due_date < as_of]
    days = max(((as_of - i.due_date).days for i in overdue), default=0)
    paid_total = sum((dec(i.amount_paid) for i in invs), D0)
    bal = sum((balance(i) for i in unpaid), D0)
    nxt = min(unpaid, key=lambda i: (i.due_date, i.id), default=None)
    if enr.status in ("withdrawn", "pending", "reserved"):
        state = enr.status
    elif days > 60:
        state = "at_risk"
    elif overdue:
        state = "overdue"
    elif bal <= 0:
        state = "paid"
    else:
        state = "current"
    return {
        "id": enr.id, "reference": enr.reference, "course": enr.course_title, "course_key": enr.course_key, "plan_type": enr.plan_type,
        "plan_code": enr.plan_code, "plan_label": enr.plan_label, "year": enr.year, "status": enr.status, "state": state,
        "auto": enr.auto, "start_date": enr.start_date, "instalments_paid": sum(1 for i in inst if i.status == "paid"),
        "instalments": len(inst), "paid_total": float(paid_total), "balance": float(bal), "overdue_amount": float(sum((balance(i) for i in overdue), D0)),
        "days_overdue": days, "next_due": nxt.due_date if nxt else None, "next_amount": float(balance(nxt)) if nxt else 0,
        "next_number": nxt.number if nxt else None, "created_at": enr.created_at,
    }
