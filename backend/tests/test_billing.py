from datetime import date, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.core.security import make_token
from app.modules.admin_auth.models import AdminUser
from app.modules.content.models import Course
from app.modules.payments import billing
from app.modules.payments.jobs import run_billing
from app.modules.payments.models import Enrolment, Invoice, Message, Payment, Slip

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


@pytest_asyncio.fixture(scope="module")
async def admin_headers():
    async with SessionLocal() as db:
        u = AdminUser(email="finance-test@example.com", full_name="Finance", password_hash="x")
        db.add(u)
        await db.commit()
        return {"Authorization": "Bearer " + make_token(str(u.id), "admin", timedelta(hours=1))}


async def enrol_and_pay(client, email: str, course_key: str = "hnd-se", plan: int = 0) -> tuple[int, str]:
    r = await client.post("/api/v1/public/orders", json={"course_key": course_key, "plan": plan, "method": "bank_transfer",
                                                          "name": "Billing Student", "phone": "0770000000", "email": email})
    assert r.status_code == 200, r.text
    async with SessionLocal() as db:
        inv = (await db.execute(select(Invoice).where(Invoice.number == r.json()["reference"]))).scalar_one()
        await billing.record_payment(db, inv, inv.amount, "cash", recorded_by="test")
        await db.commit()
        return inv.enrolment_id, inv.token


async def count_msgs(db, prefix: str) -> int:
    return (await db.execute(select(func.count()).select_from(Message).where(Message.dedupe_key.like(prefix + "%")))).scalar_one()


@pytest.mark.asyncio
async def test_issue_and_remind_exactly_once(client):
    enr_id, _ = await enrol_and_pay(client, "job@example.com")
    async with SessionLocal() as db:
        m1 = (await db.execute(select(Invoice).where(Invoice.enrolment_id == enr_id, Invoice.seq == 1, Invoice.kind == "instalment"))).scalar_one()
        due = m1.due_date
        # 6 days before: nothing yet
        assert (await run_billing(db, due - timedelta(days=6), send=False))["issued"] == 0
        # 5 days before: Month 1 issued + emailed, twice-run is a no-op
        await run_billing(db, due - timedelta(days=5), send=False)
        await run_billing(db, due - timedelta(days=5), send=False)
        await db.refresh(m1)
        assert m1.status == "open" and await count_msgs(db, f"issue:{m1.number}") == 1
        # 3 days before, due day, 7 days after: one reminder each, no repeats
        for d in (due - timedelta(days=3), due - timedelta(days=3), due, due, due + timedelta(days=7), due + timedelta(days=9)):
            await run_billing(db, d, send=False)
        await db.refresh(m1)
        assert m1.reminders == ["before", "due", "after"]
        assert await count_msgs(db, f"remind:{m1.number}:") == 3
        s = await billing.enrolment_summary(db, await db.get(Enrolment, enr_id), due + timedelta(days=9))
        assert s["state"] == "overdue" and s["days_overdue"] == 9 and s["instalments_paid"] == 0 and s["instalments"] == 9


@pytest.mark.asyncio
async def test_slip_upload_approve_and_reject(client, admin_headers):
    enr_id, _ = await enrol_and_pay(client, "slip@example.com")
    async with SessionLocal() as db:
        m1 = (await db.execute(select(Invoice).where(Invoice.enrolment_id == enr_id, Invoice.seq == 1, Invoice.kind == "instalment"))).scalar_one()
        token, number = m1.token, m1.number
    view = (await client.get(f"/api/v1/public/pay/{token}")).json()
    assert view["invoice"]["number"] == number and len(view["schedule"]) == 10   # registration + 9 months
    # a non-image is refused
    r = await client.post(f"/api/v1/public/pay/{token}/slip", data={"amount": "9999"}, files={"file": ("x.txt", b"hello", "text/plain")})
    assert r.status_code == 415
    r = await client.post(f"/api/v1/public/pay/{token}/slip", data={"amount": "9999", "reference": "BOC-123"}, files={"file": ("s.png", PNG, "image/png")})
    assert r.status_code == 200, r.text
    slips = (await client.get("/api/v1/admin/payments/slips", headers=admin_headers)).json()
    mine = [s for s in slips if s["invoice"]["number"] == number]
    assert len(mine) == 1
    # admin can open the private file; the public can't reach it
    f = await client.get(f"/api/v1/admin/payments/slips/{mine[0]['id']}/file", headers=admin_headers)
    assert f.status_code == 200 and f.content.startswith(b"\x89PNG")
    assert (await client.get(f"/api/v1/admin/payments/slips/{mine[0]['id']}/file")).status_code == 401
    # reject needs a reason, then emails the student
    assert (await client.post(f"/api/v1/admin/payments/slips/{mine[0]['id']}/reject", json={"reason": ""}, headers=admin_headers)).status_code == 422
    assert (await client.post(f"/api/v1/admin/payments/slips/{mine[0]['id']}/reject", json={"reason": "Amount is not visible"}, headers=admin_headers)).status_code == 200
    # upload again and approve -> paid by bank slip
    await client.post(f"/api/v1/public/pay/{token}/slip", data={"amount": "9999"}, files={"file": ("s.png", PNG, "image/png")})
    pending = [s for s in (await client.get("/api/v1/admin/payments/slips", headers=admin_headers)).json() if s["invoice"]["number"] == number]
    assert (await client.post(f"/api/v1/admin/payments/slips/{pending[0]['id']}/approve", json={}, headers=admin_headers)).status_code == 200
    async with SessionLocal() as db:
        inv = (await db.execute(select(Invoice).where(Invoice.number == number))).scalar_one()
        assert inv.status == "paid"
        pay = (await db.execute(select(Payment).where(Payment.invoice_id == inv.id))).scalar_one()
        assert pay.method == "bank_slip"
        assert await count_msgs(db, "slip-rejected:") >= 1
        s = await billing.enrolment_summary(db, await db.get(Enrolment, enr_id))
        assert s["instalments_paid"] == 1 and s["next_due"] == billing.add_months(s["start_date"], 2)


@pytest.mark.asyncio
async def test_year2_reserve_and_auto_off(client):
    # HND Year 1 in full -> completed; finance starts Year 2
    enr_id, _ = await enrol_and_pay(client, "year2@example.com", plan=1)
    async with SessionLocal() as db:
        enr = await db.get(Enrolment, enr_id)
        assert enr.status == "completed"
        rows = await billing.start_year2(db, enr, first_due=date(2027, 9, 1), instalments=9, amount=9999)
        await db.commit()
        assert len(rows) == 9 and rows[0].year == 2 and rows[-1].due_date == date(2028, 5, 1) and enr.status == "active"
        with pytest.raises(billing.BillingError):
            await billing.start_year2(db, enr, first_due=date(2027, 9, 1), instalments=9, amount=9999)

    # reserve my seat -> reserved, no schedule until finance sets the plan
    enr_id, _ = await enrol_and_pay(client, "reserve@example.com", plan=2)
    async with SessionLocal() as db:
        enr = await db.get(Enrolment, enr_id)
        assert enr.status == "reserved"
        assert (await db.execute(select(func.count()).select_from(Invoice).where(Invoice.enrolment_id == enr.id, Invoice.kind == "instalment"))).scalar_one() == 0
        rows = await billing.set_plan(db, enr, code="monthly", first_due=date(2027, 3, 10), instalments=12, amount=8000)
        await db.commit()
        assert len(rows) == 12 and enr.status == "active"

    # course with automatic instalments off: first payment works, no schedule
    async with SessionLocal() as db:
        db.add(Course(key="hnd-manual", slug="hnd-manual-test", title="HND Manual", short="HND · Manual", level="HND", plan_type="hnd",
                      fee=280000, status="published", detail={}, source={}, auto_instalments=False))
        await db.commit()
    enr_id, _ = await enrol_and_pay(client, "manual@example.com", course_key="hnd-manual", plan=0)
    async with SessionLocal() as db:
        enr = await db.get(Enrolment, enr_id)
        assert enr.status == "active" and not enr.auto
        assert (await db.execute(select(func.count()).select_from(Invoice).where(Invoice.enrolment_id == enr.id, Invoice.kind == "instalment"))).scalar_one() == 0


@pytest.mark.asyncio
async def test_admin_lists_and_withdraw(client, admin_headers):
    enr_id, _ = await enrol_and_pay(client, "withdraw@example.com")
    rows = (await client.get("/api/v1/admin/payments/students?q=withdraw@", headers=admin_headers)).json()
    assert len(rows) == 1 and rows[0]["instalments"] == 9 and rows[0]["state"] == "current"
    assert (await client.post(f"/api/v1/admin/payments/enrolments/{enr_id}/withdraw", json={"reason": "moved abroad"}, headers=admin_headers)).json()["cancelled"] == 9
    rows = (await client.get("/api/v1/admin/payments/students?q=withdraw@", headers=admin_headers)).json()
    assert rows[0]["state"] == "withdrawn" and rows[0]["balance"] == 0
    csv = await client.get("/api/v1/admin/payments/export/students.csv", headers=admin_headers)
    assert csv.status_code == 200 and "withdraw@example.com" in csv.text
    assert (await client.get("/api/v1/admin/payments/overview")).status_code == 401
