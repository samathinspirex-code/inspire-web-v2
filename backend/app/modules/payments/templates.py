"""Payment emails: branded HTML + plain text. Each function returns (subject, html, text)."""
from datetime import date
from html import escape

from app.core.config import settings
from app.modules.payments.pricing import lkr

BRAND = "#5b21b6"


def pay_url(token: str) -> str:
    return f"{settings.SITE_URL.rstrip('/')}/pay/{token}"


def fmt_date(d: date | None) -> str:
    return d.strftime("%d %b %Y") if d else ""


def _layout(title: str, body_html: str, cta: tuple[str, str] | None = None, foot: str = "") -> str:
    button = ""
    if cta:
        button = (f'<p style="margin:26px 0"><a href="{escape(cta[1])}" style="background:{BRAND};color:#fff;text-decoration:none;'
                  f'padding:13px 22px;border-radius:999px;font-weight:600;display:inline-block">{escape(cta[0])}</a></p>'
                  f'<p style="font-size:12px;color:#6b6280">Or open this link: <a href="{escape(cta[1])}" style="color:{BRAND}">{escape(cta[1])}</a></p>')
    return f"""<!doctype html><html><body style="margin:0;background:#f5f2fb;font-family:Arial,Helvetica,sans-serif;color:#1d1530">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:22px;overflow:hidden" cellpadding="0" cellspacing="0">
<tr><td style="background:{BRAND};padding:20px 28px;color:#fff;font-size:20px;font-weight:700">inspire<span style="font-weight:400;opacity:.85">college</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.3">{escape(title)}</h1>
{body_html}{button}
<p style="margin-top:28px;font-size:13px;color:#6b6280">{foot or "Questions? Reply to this email or WhatsApp us on " + escape(_wa())}</p>
</td></tr></table>
<p style="font-size:11px;color:#8a8199;margin-top:14px">Inspire College · Colombo, Sri Lanka</p>
</td></tr></table></body></html>"""


def _wa() -> str:
    return "+94 76 097 4225"


def _invoice_rows(inv: dict) -> str:
    rows = [("Invoice", inv["number"]), ("For", inv["description"]), ("Amount", lkr(inv["balance"])), ("Due", fmt_date(inv["due_date"]))]
    tr = "".join(f'<tr><td style="padding:7px 0;color:#6b6280;width:110px">{escape(k)}</td><td style="padding:7px 0;font-weight:600">{escape(str(v))}</td></tr>' for k, v in rows)
    return f'<table role="presentation" width="100%" style="border-top:1px solid #eee;border-bottom:1px solid #eee;margin:16px 0">{tr}</table>'


def _schedule_html(schedule: list[dict]) -> str:
    if not schedule:
        return ""
    tr = "".join(
        f'<tr><td style="padding:6px 8px">{escape(s["label"])}</td><td style="padding:6px 8px">{escape(fmt_date(s["due_date"]))}</td>'
        f'<td style="padding:6px 8px;text-align:right">{escape(lkr(s["amount"]))}</td>'
        f'<td style="padding:6px 8px;color:{"#15803d" if s["status"] == "paid" else "#6b6280"}">{escape(s["status_label"])}</td></tr>'
        for s in schedule)
    return ('<p style="margin:18px 0 6px;font-weight:600">Your payment schedule</p>'
            f'<table role="presentation" width="100%" style="font-size:13px;border-collapse:collapse;background:#faf8fe;border-radius:12px">{tr}</table>')


def _schedule_text(schedule: list[dict]) -> str:
    return "\n".join(f"- {s['label']}: {lkr(s['amount'])}, due {fmt_date(s['due_date'])} — {s['status_label']}" for s in schedule)


def invoice_issued(first: str, inv: dict) -> tuple[str, str, str]:
    subject = f"Invoice {inv['number']} — {inv['description']} due {fmt_date(inv['due_date'])}"
    body = (f"<p>Hi {escape(first)},</p><p>Your next payment for <b>{escape(inv['course'])}</b> is ready.</p>" + _invoice_rows(inv) +
            "<p>Pay securely by card, or upload your bank-transfer slip, using the button below.</p>")
    text = (f"Hi {first},\n\nYour next payment for {inv['course']} is ready.\n\nInvoice: {inv['number']}\nFor: {inv['description']}\n"
            f"Amount: {lkr(inv['balance'])}\nDue: {fmt_date(inv['due_date'])}\n\nPay by card or upload your bank slip: {pay_url(inv['token'])}\n")
    return subject, _layout("Your invoice is ready", body, ("Pay now", pay_url(inv["token"]))), text


REMINDER_LINES = {
    "before": ("Payment due soon", "is due on {due}."),
    "due": ("Payment due today", "is due today."),
    "after": ("Payment overdue", "was due on {due} and is now overdue. Please pay as soon as you can to keep your place."),
}


def reminder(first: str, inv: dict, stage: str) -> tuple[str, str, str]:
    title, line = REMINDER_LINES[stage]
    line = line.format(due=fmt_date(inv["due_date"]))
    subject = f"{title}: {inv['description']} — {lkr(inv['balance'])}"
    body = f"<p>Hi {escape(first)},</p><p>A friendly reminder that your payment for <b>{escape(inv['course'])}</b> {escape(line)}</p>" + _invoice_rows(inv)
    text = f"Hi {first},\n\nA friendly reminder that your payment for {inv['course']} {line}\n\nInvoice {inv['number']}: {lkr(inv['balance'])}\nPay: {pay_url(inv['token'])}\n"
    return subject, _layout(title, body, ("Pay now", pay_url(inv["token"]))), text


def receipt(first: str, inv: dict, amount, method: str, schedule: list[dict], next_inv: dict | None) -> tuple[str, str, str]:
    how = {"payhere": "card (PayHere)", "bank_slip": "bank transfer", "bank_transfer": "bank transfer", "cash": "cash"}.get(method, method)
    subject = f"Payment received — {inv['description']} ({lkr(amount)})"
    nxt = ""
    nxt_t = ""
    if next_inv:
        nxt = f"<p>Your next payment is <b>{escape(lkr(next_inv['amount']))}</b>, due <b>{escape(fmt_date(next_inv['due_date']))}</b>. We'll email you the invoice a few days before.</p>"
        nxt_t = f"\nNext payment: {lkr(next_inv['amount'])}, due {fmt_date(next_inv['due_date'])}.\n"
    body = (f"<p>Hi {escape(first)},</p><p>Thank you! We received <b>{escape(lkr(amount))}</b> by {escape(how)} for "
            f"<b>{escape(inv['description'])}</b> (invoice {escape(inv['number'])}).</p>" + nxt + _schedule_html(schedule))
    text = (f"Hi {first},\n\nThank you! We received {lkr(amount)} by {how} for {inv['description']} (invoice {inv['number']}).\n{nxt_t}"
            + (f"\nYour schedule:\n{_schedule_text(schedule)}\n" if schedule else ""))
    return subject, _layout("Payment received", body, ("View my payments", pay_url(inv["token"]))), text


def slip_received(first: str, inv: dict) -> tuple[str, str, str]:
    subject = f"We received your bank slip — {inv['number']}"
    body = f"<p>Hi {escape(first)},</p><p>Thanks for uploading your bank slip for <b>{escape(inv['description'])}</b>. Our finance team will check it, usually within one working day, and email you when it's confirmed.</p>"
    text = f"Hi {first},\n\nThanks for uploading your bank slip for {inv['description']} ({inv['number']}). Our finance team will check it and email you when it's confirmed.\n"
    return subject, _layout("Slip received", body), text


def slip_rejected(first: str, inv: dict, reason: str) -> tuple[str, str, str]:
    subject = f"Please check your bank slip — {inv['number']}"
    body = (f"<p>Hi {escape(first)},</p><p>We couldn't confirm the bank slip you uploaded for <b>{escape(inv['description'])}</b>.</p>"
            f'<p style="background:#fff4f4;border-radius:12px;padding:12px 14px">{escape(reason)}</p><p>You can upload a new slip or pay by card using the button below.</p>')
    text = f"Hi {first},\n\nWe couldn't confirm the bank slip you uploaded for {inv['description']} ({inv['number']}).\nReason: {reason}\n\nUpload again or pay by card: {pay_url(inv['token'])}\n"
    return subject, _layout("We couldn't confirm your slip", body, ("Upload again or pay by card", pay_url(inv["token"]))), text


def finance_slip_alert(student: str, inv: dict, amount, reference: str) -> tuple[str, str, str]:
    subject = f"New bank slip to review — {inv['number']} ({lkr(amount)})"
    admin = f"{settings.SITE_URL.rstrip('/')}/admin/payments/slips"
    body = (f"<p>{escape(student)} uploaded a bank slip for <b>{escape(inv['description'])}</b> ({escape(inv['course'])}).</p>"
            f"<p>Amount: <b>{escape(lkr(amount))}</b><br>Reference: {escape(reference or '-')}</p>")
    text = f"{student} uploaded a bank slip for {inv['description']} ({inv['course']}).\nAmount: {lkr(amount)}\nReference: {reference or '-'}\nReview: {admin}\n"
    return subject, _layout("Bank slip to review", body, ("Review in the CMS", admin), foot="Inspire website · payments"), text
