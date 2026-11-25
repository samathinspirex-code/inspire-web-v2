"""Email outbox + Mailjet delivery (same v3.1 Send API as inspire-api-host/app/core/public_form_email.py).

Emails are queued in `messages` and delivered by the billing job, so a Mailjet outage never blocks a payment.
MAIL_ENABLED=false keeps everything queued; MAIL_TEST_TO redirects every email to one inbox for testing.
"""
import ssl
from datetime import timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.types import utcnow
from app.modules.payments.models import Message

MAILJET_URL = "https://api.mailjet.com/v3.1/send"
MAX_ATTEMPTS = 5
STALE_AFTER = timedelta(days=3)   # queued while email was off for longer than this → skipped, not sent late


def _tls():
    """Trust the operating system's certificates (works behind antivirus / company HTTPS inspection); else certifi."""
    try:
        import truststore
        return truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    except ImportError:
        return True


async def queue(db: AsyncSession, *, kind: str, to_email: str, to_name: str, subject: str, html: str, text: str,
                invoice_id: int | None = None, student_id: int | None = None, dedupe_key: str | None = None) -> Message | None:
    """Add an email to the outbox. With a dedupe_key the same automatic email is only ever queued once."""
    if not to_email:
        return None
    if dedupe_key and (await db.execute(select(Message.id).where(Message.dedupe_key == dedupe_key))).first():
        return None
    msg = Message(kind=kind, to_email=to_email.strip(), to_name=to_name[:200], subject=subject[:300], html=html, text=text,
                  invoice_id=invoice_id, student_id=student_id, dedupe_key=dedupe_key)
    try:
        async with db.begin_nested():   # savepoint: a duplicate never undoes the caller's other changes
            db.add(msg)
    except IntegrityError:  # raced with another run: already queued
        return None
    return msg


async def deliver(msg: Message) -> tuple[bool, str]:
    if not settings.MAILJET_API_KEY or not settings.MAILJET_SECRET_KEY:
        return False, "Mailjet keys are not set"
    to_email, to_name, subject = msg.to_email, msg.to_name or msg.to_email, msg.subject
    if settings.MAIL_TEST_TO:
        subject, to_email, to_name = f"[TEST → {msg.to_email}] {subject}", settings.MAIL_TEST_TO, "Test inbox"
    payload = {"Messages": [{
        "From": {"Email": settings.MAIL_FROM_EMAIL, "Name": settings.MAIL_FROM_NAME},
        "To": [{"Email": to_email, "Name": to_name}],
        "Subject": subject, "TextPart": msg.text, "HTMLPart": msg.html, "CustomID": f"web-v2-{msg.kind}-{msg.id}",
    }]}
    try:
        async with httpx.AsyncClient(timeout=20, verify=_tls()) as client:
            r = await client.post(MAILJET_URL, json=payload, auth=(settings.MAILJET_API_KEY, settings.MAILJET_SECRET_KEY))
        if r.status_code >= 300:
            return False, f"Mailjet {r.status_code}: {r.text[:300]}"
        status = ((r.json().get("Messages") or [{}])[0]).get("Status")
        return (status == "success"), ("" if status == "success" else f"Mailjet status {status}")
    except httpx.HTTPError as e:
        return False, f"network: {e}"[:300]


async def flush(db: AsyncSession, limit: int = 25) -> dict:
    """Send queued emails. Returns counts. Does nothing while MAIL_ENABLED is false (messages stay queued)."""
    sent = failed = skipped = 0
    rows = (await db.execute(select(Message).where(Message.status == "queued").order_by(Message.id).limit(limit))).scalars().all()
    now = utcnow()
    for msg in rows:
        if msg.created_at and now - msg.created_at > STALE_AFTER:
            msg.status, msg.error = "skipped", "too old to send (email was switched off)"
            skipped += 1
            continue
        if not settings.MAIL_ENABLED:
            continue
        ok, err = await deliver(msg)
        msg.attempts += 1
        if ok:
            msg.status, msg.sent_at, msg.error = "sent", utcnow(), ""
            sent += 1
        else:
            msg.error = err[:500]
            if msg.attempts >= MAX_ATTEMPTS:
                msg.status = "failed"
                failed += 1
    await db.commit()
    return {"sent": sent, "failed": failed, "skipped": skipped}
