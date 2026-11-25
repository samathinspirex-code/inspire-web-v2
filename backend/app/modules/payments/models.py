"""Payments: students, enrolments, instalment invoices, receipts, bank slips, PayHere events and an email outbox.

Modelled on inspire-api-host/app/modules/payments (learners → enrolments → instalments/invoices → payments),
trimmed to what the website needs. One secure token per invoice gives the student's /pay/{token} page.
"""
from sqlalchemy import Boolean, Date, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import JsonType, UTCDateTime, utcnow


class Student(Base):
    __tablename__ = "students"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_no: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)   # S1000…
    name: Mapped[str] = mapped_column(String(200), default="")
    email: Mapped[str] = mapped_column(String(200), default="", index=True)                # stored lower-case
    phone: Mapped[str] = mapped_column(String(60), default="")
    created_at = mapped_column(UTCDateTime, default=utcnow)


class Enrolment(Base):
    __tablename__ = "enrolments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reference: Mapped[str] = mapped_column(String(20), unique=True, index=True)             # IC-XXXXXX shown at checkout
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    course_key: Mapped[str] = mapped_column(String(120), default="")
    course_title: Mapped[str] = mapped_column(String(300), default="")
    plan_type: Mapped[str] = mapped_column(String(10), default="")       # hnd | fnd | cpd | pg
    plan_code: Mapped[str] = mapped_column(String(20), default="full")   # monthly | full | reserve
    plan_label: Mapped[str] = mapped_column(String(200), default="")
    year: Mapped[int] = mapped_column(Integer, default=1)
    registration_fee = mapped_column(Numeric(12, 2), default=0)
    instalment_amount = mapped_column(Numeric(12, 2), default=0)
    instalments: Mapped[int] = mapped_column(Integer, default=0)
    start_date = mapped_column(Date, nullable=True)                    # first payment date: instalments run monthly from here
    auto: Mapped[bool] = mapped_column(Boolean, default=True)          # course has automatic instalments on
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | reserved | active | completed | withdrawn
    method: Mapped[str] = mapped_column(String(20), default="payhere")  # how they chose to pay at enrolment
    extra = mapped_column(JsonType, default=dict)
    created_at = mapped_column(UTCDateTime, default=utcnow)
    activated_at = mapped_column(UTCDateTime, nullable=True)
    withdrawn_at = mapped_column(UTCDateTime, nullable=True)


class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)        # INV-10000…
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)                 # /pay/{token}
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    enrolment_id: Mapped[int | None] = mapped_column(ForeignKey("enrolments.id", ondelete="CASCADE"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(20), default="other")      # registration | instalment | full | other
    year: Mapped[int] = mapped_column(Integer, default=1)
    seq: Mapped[int | None] = mapped_column(Integer, nullable=True)      # month 3 …
    of: Mapped[int | None] = mapped_column(Integer, nullable=True)       # … of 9
    description: Mapped[str] = mapped_column(String(300), default="")
    lines = mapped_column(JsonType, default=list)
    amount = mapped_column(Numeric(12, 2))
    amount_paid = mapped_column(Numeric(12, 2), default=0)
    currency: Mapped[str] = mapped_column(String(3), default="LKR")
    issue_date = mapped_column(Date, nullable=True)                     # when it was emailed / opened
    due_date = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="open")     # scheduled | open | paid | cancelled
    reminders = mapped_column(JsonType, default=list)                   # stages already sent: before | due | after
    last_reminder_at = mapped_column(UTCDateTime, nullable=True)
    created_at = mapped_column(UTCDateTime, default=utcnow)
    paid_at = mapped_column(UTCDateTime, nullable=True)


class InvoiceCheckout(Base):
    """One row per PayHere checkout attempt; PayHere's order_id is {invoice number}-{attempt}."""
    __tablename__ = "invoice_checkouts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    gateway_order_id: Mapped[str] = mapped_column(String(60), unique=True)
    amount = mapped_column(Numeric(12, 2))
    created_at = mapped_column(UTCDateTime, default=utcnow)


class GatewayEvent(Base):
    __tablename__ = "gateway_events"
    # Only one posted event per PayHere payment_id (NULLs are allowed many times).
    __table_args__ = (UniqueConstraint("posted_payment_id", name="uq_gateway_posted_payment"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    gateway_order_id: Mapped[str] = mapped_column(String(60), index=True)
    payment_id: Mapped[str] = mapped_column(String(60), default="")
    posted_payment_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    status_code: Mapped[str] = mapped_column(String(5), default="")
    amount: Mapped[str] = mapped_column(String(20), default="")
    currency: Mapped[str] = mapped_column(String(3), default="")
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    outcome: Mapped[str] = mapped_column(String(60), default="")
    payload = mapped_column(JsonType, default=dict)
    created_at = mapped_column(UTCDateTime, default=utcnow)


class Payment(Base):
    """A receipt: money received against an invoice."""
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    amount = mapped_column(Numeric(12, 2))
    method: Mapped[str] = mapped_column(String(20), default="payhere")   # payhere | bank_slip | bank_transfer | cash
    gateway_payment_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)
    reference: Mapped[str] = mapped_column(String(120), default="")
    note: Mapped[str] = mapped_column(String(500), default="")
    received_on = mapped_column(Date, nullable=True)
    recorded_by: Mapped[str] = mapped_column(String(200), default="")
    created_at = mapped_column(UTCDateTime, default=utcnow)


class Slip(Base):
    """Bank-transfer slip uploaded by a student. The file lives in a private folder, never a public URL."""
    __tablename__ = "payment_slips"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    file_path: Mapped[str] = mapped_column(String(300))
    file_name: Mapped[str] = mapped_column(String(200), default="")
    mime: Mapped[str] = mapped_column(String(60), default="")
    size: Mapped[int] = mapped_column(Integer, default=0)
    amount = mapped_column(Numeric(12, 2))
    paid_on = mapped_column(Date, nullable=True)
    reference: Mapped[str] = mapped_column(String(120), default="")
    note: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(20), default="pending")   # pending | approved | rejected
    reason: Mapped[str] = mapped_column(String(500), default="")
    reviewed_by: Mapped[str] = mapped_column(String(200), default="")
    reviewed_at = mapped_column(UTCDateTime, nullable=True)
    created_at = mapped_column(UTCDateTime, default=utcnow)


class Message(Base):
    """Email outbox. dedupe_key makes automatic emails (invoice issued, each reminder stage) send exactly once."""
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dedupe_key: Mapped[str | None] = mapped_column(String(120), unique=True, nullable=True)
    kind: Mapped[str] = mapped_column(String(40), default="")
    to_email: Mapped[str] = mapped_column(String(200), default="")
    to_name: Mapped[str] = mapped_column(String(200), default="")
    subject: Mapped[str] = mapped_column(String(300), default="")
    html: Mapped[str] = mapped_column(Text, default="")
    text: Mapped[str] = mapped_column(Text, default="")
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True, index=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="queued")   # queued | sent | failed | skipped
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str] = mapped_column(String(500), default="")
    created_at = mapped_column(UTCDateTime, default=utcnow)
    sent_at = mapped_column(UTCDateTime, nullable=True)
