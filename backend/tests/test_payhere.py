from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.modules.payments import billing, payhere
from app.modules.payments.models import Enrolment, Invoice, Message


def signed(order_id: str, amount: str, status: str = "2", payment_id: str = "320025071234", currency: str = "LKR") -> dict:
    body = {"merchant_id": settings.PAYHERE_MERCHANT_ID, "order_id": order_id, "payhere_amount": amount, "payhere_currency": currency,
            "status_code": status, "payment_id": payment_id}
    body["md5sig"] = payhere.md5("".join(body[k] for k in ["merchant_id", "order_id", "payhere_amount", "payhere_currency", "status_code"])
                                 + payhere.md5(settings.PAYHERE_MERCHANT_SECRET))
    return body


def test_checkout_hash_matches_payhere_formula():
    expected = payhere.md5(settings.PAYHERE_MERCHANT_ID + "INV-10001-1" + "10000.00" + "LKR" + payhere.md5(settings.PAYHERE_MERCHANT_SECRET))
    assert payhere.checkout_hash("INV-10001-1", Decimal("10000")) == expected


def test_verify_rejects_tampered_signature():
    body = signed("INV-10001-1", "10000.00")
    assert payhere.verify(body)
    body["payhere_amount"] = "1.00"
    assert not payhere.verify(body)


@pytest.mark.asyncio
async def test_enrol_pay_and_monthly_schedule(client):
    r = await client.post("/api/v1/public/orders", json={"course_key": "hnd-se", "plan": 0, "method": "payhere", "name": "Test Student",
                                                          "phone": "0771234567", "email": "monthly@example.com"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["amount"] == 10000  # HND monthly plan: registration due today, computed by the server
    assert data["reference"].startswith("INV-") and "/pay/" in data["pay_url"]
    fields = data["checkout"]["fields"]
    assert data["checkout"]["action"].startswith("https://sandbox.payhere.lk")
    ref, gw_order = data["reference"], fields["order_id"]
    assert gw_order == ref + "-1"

    # wrong amount -> rejected, still pending
    await client.post("/api/v1/payments/payhere/notify", data=signed(gw_order, "1.00", payment_id="p-wrong"))
    assert (await client.get(f"/api/v1/public/orders/{ref}")).json()["status"] == "pending"
    # invalid signature -> rejected
    bad = signed(gw_order, "10000.00", payment_id="p-bad")
    bad["md5sig"] = "0" * 32
    await client.post("/api/v1/payments/payhere/notify", data=bad)
    assert (await client.get(f"/api/v1/public/orders/{ref}")).json()["status"] == "pending"
    # valid -> paid
    r = await client.post("/api/v1/payments/payhere/notify", data=signed(gw_order, "10000.00", payment_id="p-ok"))
    assert r.status_code == 200 and r.text == "OK"
    assert (await client.get(f"/api/v1/public/orders/{ref}")).json()["status"] == "paid"
    # duplicate notification is ignored safely
    r = await client.post("/api/v1/payments/payhere/notify", data=signed(gw_order, "10000.00", payment_id="p-ok"))
    assert r.status_code == 200

    async with SessionLocal() as db:
        first = (await db.execute(select(Invoice).where(Invoice.number == ref))).scalar_one()
        enr = await db.get(Enrolment, first.enrolment_id)
        assert enr.status == "active" and enr.start_date == billing.today()
        inst = (await db.execute(select(Invoice).where(Invoice.enrolment_id == enr.id, Invoice.kind == "instalment")
                                 .order_by(Invoice.seq))).scalars().all()
        assert len(inst) == 9 and all(i.status == "scheduled" and float(i.amount) == 9999 for i in inst)
        assert [i.due_date for i in inst] == [billing.add_months(enr.start_date, n) for n in range(1, 10)]
        receipts = (await db.execute(select(func.count()).select_from(Message).where(Message.kind == "receipt", Message.invoice_id == first.id))).scalar_one()
        assert receipts == 1   # duplicate notify did not send a second receipt


@pytest.mark.asyncio
async def test_bank_transfer_with_addons_queues_invoice_email(client):
    r = await client.post("/api/v1/public/orders", json={"course_key": "hnd-se", "plan": 1, "addons": ["c-aimastery"], "method": "bank_transfer",
                                                          "name": "Bank Student", "phone": "0771234500", "email": "bank@example.com"})
    body = r.json()
    assert body["amount"] == 99900 + round(75000 * 0.75)
    assert body["checkout"] is None and body["pay_url"]   # bank transfer: no gateway, invoice link instead
    async with SessionLocal() as db:
        inv = (await db.execute(select(Invoice).where(Invoice.number == body["reference"]))).scalar_one()
        assert inv.kind == "full" and len(inv.lines) == 2
        assert (await db.execute(select(func.count()).select_from(Message).where(Message.dedupe_key == f"issue:{inv.number}"))).scalar_one() == 1


def test_month_end_dates():
    anchor = date(2027, 1, 31)
    assert [billing.add_months(anchor, n) for n in (1, 2, 3)] == [date(2027, 2, 28), date(2027, 3, 31), date(2027, 4, 30)]
    assert billing.add_months(date(2027, 11, 30), 3) == date(2028, 2, 29)
