"""PayHere Checkout API, copied from inspire-api-host/app/modules/payments/payhere.py.

Never trust the browser return URL as proof of payment: only a verified notify records a payment.
Checkout is per invoice: PayHere order_id = {invoice number}-{attempt}.
"""
import hashlib
import hmac
from decimal import Decimal, InvalidOperation

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.payments import billing
from app.modules.payments.models import Enrolment, GatewayEvent, Invoice, InvoiceCheckout, Student

SENSITIVE = {"card_no", "card_expiry", "card_holder_name", "md5sig"}


class PayError(Exception):
    def __init__(self, status: int, message: str):
        self.status, self.message = status, message


def md5(value: str) -> str:
    return hashlib.md5(value.encode("utf-8")).hexdigest().upper()


def money(v) -> Decimal:
    try:
        d = Decimal(str(v)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError, TypeError) as e:
        raise ValueError("bad amount") from e
    if not d.is_finite():
        raise ValueError("bad amount")
    return d


def checkout_hash(order_id: str, amount) -> str:
    return md5(settings.PAYHERE_MERCHANT_ID + order_id + f"{money(amount):.2f}" + "LKR" + md5(settings.PAYHERE_MERCHANT_SECRET))


def verify(body: dict) -> bool:
    if not settings.PAYHERE_MERCHANT_SECRET or str(body.get("merchant_id", "")) != settings.PAYHERE_MERCHANT_ID:
        return False
    keys = ["merchant_id", "order_id", "payhere_amount", "payhere_currency", "status_code"]
    if any(not isinstance(body.get(k), str) for k in keys):
        return False
    expected = md5("".join(body[k] for k in keys) + md5(settings.PAYHERE_MERCHANT_SECRET))
    return hmac.compare_digest(expected, str(body.get("md5sig", "")).upper())


def action_url() -> str:
    return "https://www.payhere.lk/pay/checkout" if settings.PAYHERE_MODE == "live" else "https://sandbox.payhere.lk/pay/checkout"


async def checkout(db: AsyncSession, inv: Invoice) -> dict:
    if inv.status not in ("open", "scheduled"):
        raise PayError(409, "This invoice is " + inv.status)
    amount = billing.balance(inv)
    if amount <= 0:
        raise PayError(409, "Nothing left to pay on this invoice")
    if not settings.PAYHERE_MERCHANT_ID or not settings.PAYHERE_MERCHANT_SECRET:
        raise PayError(409, "Card payments are not switched on yet. Please upload a bank slip, or contact us.")
    if settings.PAYHERE_MODE not in {"sandbox", "live"}:
        raise PayError(409, "Invalid PayHere mode")
    base = settings.PUBLIC_BASE_URL.rstrip("/")
    site = settings.SITE_URL.rstrip("/")
    if settings.PAYHERE_MODE == "live" and not base.startswith("https://"):
        raise PayError(409, "Live checkout requires a public HTTPS address")
    attempts = (await db.execute(select(func.count()).select_from(InvoiceCheckout).where(InvoiceCheckout.invoice_id == inv.id))).scalar_one()
    gw_order = f"{inv.number}-{attempts + 1}"
    db.add(InvoiceCheckout(invoice_id=inv.id, gateway_order_id=gw_order, amount=amount))
    await db.commit()
    student = await db.get(Student, inv.student_id)
    first, _, last = (student.name or "Student").partition(" ")
    fields = dict(
        merchant_id=settings.PAYHERE_MERCHANT_ID,
        return_url=f"{site}/pay/{inv.token}?status=return",
        cancel_url=f"{site}/pay/{inv.token}?status=cancelled",
        notify_url=base + "/api/v1/payments/payhere/notify",
        order_id=gw_order, items=("Inspire College — " + (inv.description or "Payment"))[:250], currency="LKR",
        amount=f"{money(amount):.2f}", first_name=first[:50], last_name=(last or "-")[:50], email=student.email or "",
        phone=student.phone, address="Colombo", city="Colombo", country="Sri Lanka", custom_1=inv.number, custom_2="",
        hash=checkout_hash(gw_order, amount),
    )
    return {"action": action_url(), "fields": fields}


async def notify(db: AsyncSession, body: dict) -> dict:
    valid = verify(body)
    try:
        amount = money(body.get("payhere_amount"))
    except ValueError:
        amount = None
    try:
        status = int(body.get("status_code", ""))
    except (ValueError, TypeError):
        status = None
    raw = {k: str(v)[:1000] for k, v in body.items() if k not in SENSITIVE}
    payment_id = str(body.get("payment_id", "")).strip()[:60]
    gw_order = str(body.get("order_id", ""))[:60]

    async def log(outcome: str, reason: str, posted: bool = False) -> dict:
        db.add(GatewayEvent(
            gateway_order_id=gw_order, payment_id=payment_id, posted_payment_id=payment_id if posted else None,
            status_code=str(status if status is not None else "")[:5], amount=str(amount or "")[:20],
            currency=str(body.get("payhere_currency", ""))[:3], verified=valid, outcome=outcome, payload=dict(raw, reason=reason),
        ))
        await db.commit()
        return {"ok": outcome != "rejected", "outcome": outcome, "reason": reason}

    if not valid:
        return await log("rejected", "invalid signature")
    if status != 2:
        return await log("ignored", "status " + str(status))   # cancelled / failed / pending: money did not move
    if not payment_id or amount is None or amount <= 0:
        return await log("rejected", "missing payment ID or invalid amount")
    dup = (await db.execute(select(GatewayEvent.id).where(GatewayEvent.posted_payment_id == payment_id))).first()
    if dup:
        return await log("duplicate", "duplicate payment")
    att = (await db.execute(select(InvoiceCheckout).where(InvoiceCheckout.gateway_order_id == gw_order))).scalar_one_or_none()
    if not att:
        return await log("rejected", "unknown checkout order")
    inv = await db.get(Invoice, att.invoice_id)
    if body.get("payhere_currency") != "LKR" or amount != money(att.amount):
        return await log("rejected", "amount or currency mismatch")
    if inv.status in ("paid", "cancelled") or amount > money(billing.balance(inv)):
        return await log("rejected", f"invoice is {inv.status} or balance changed; review captured funds manually")
    try:
        await billing.record_payment(db, inv, amount, "payhere", gateway_payment_id=payment_id, reference=gw_order,
                                     recorded_by="PayHere")
        return await log("posted", "verified payment", posted=True)
    except IntegrityError:
        await db.rollback()
        return {"ok": True, "outcome": "duplicate", "reason": "duplicate payment"}


async def simulate(db: AsyncSession, inv: Invoice) -> None:
    """Sandbox-only test helper: behaves like a verified PayHere payment for the invoice balance."""
    amount = billing.balance(inv)
    await billing.record_payment(db, inv, amount, "payhere", gateway_payment_id=f"SIM-{inv.number}-{billing.new_token()[:6]}",
                                 reference="sandbox simulation", recorded_by="Sandbox simulation")
