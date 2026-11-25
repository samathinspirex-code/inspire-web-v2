from datetime import datetime
from decimal import Decimal

from sqlalchemy import inspect, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.content.models import SiteSetting

# Defaults for every website setting. Keys mirror the current site's site_settings where they overlap.
DEFAULT_SETTINGS: dict = {
    "announcement_enabled": False,
    "announcement_text": "",
    "announcement_link": "",
    "christmas_theme": False,
    "hero_slides": [],            # optional overrides for the home hero video wall
    "promo_banner": {"enabled": False, "title": "", "text": "", "cta": "", "link": "", "image": ""},
    "contact": {
        "whatsapp_main": "94760974225",      # current number (+94 76 097 4225)
        "whatsapp_advisor": "94760974225",
        "phone_display": "+94 76 097 4225",
        "email": "enrol@inspire.college",
    },
    "theme": {"palette": "purple", "shape": "", "font": ""},  # site default; visitors can still change theirs
    "tracking": {"gtm": "", "ga4": "", "metaPixel": "", "tiktokPixel": "", "googleAdsId": "", "googleAdsPurchaseLabel": "", "googleAdsLeadLabel": ""},
    "fee_plans": {},             # overrides for HND/Foundation plans; empty = design defaults
    "default_campaign": "scholarship",
    "home_extra_cards": [],      # extra cards on the home programme grid that are not a single course (e.g. Jain University degrees)
    # Instalment billing (admin only; never sent in the public bundle). Defaults copied from the current Accounts module.
    "billing": {
        "invoice_lead_days": 5,          # issue + email each monthly invoice this many days before it is due
        "remind_before_days": 3,         # reminder stages: before, on the due date, after
        "remind_on_due": True,
        "remind_after_days": 7,
        "finance_email": "",             # gets an alert when a student uploads a bank slip
        "bank": {"account_name": "Inspire College (Pvt) Ltd", "bank": "", "branch": "", "account_no": "", "note": "Use your invoice number as the payment reference."},
        "year2": {"hnd": {"instalments": 9, "instalment_amount": 9999}},   # prefill for "Start Year 2"
    },
    "seo": {"site_name": "Inspire College", "default_description": "100% online UK-regulated ATHE qualifications, HNDs, Foundations, top-up degrees, postgraduate and CPD courses."},
}


def to_dict(obj) -> dict:
    out = {}
    for col in inspect(obj).mapper.column_attrs:
        v = getattr(obj, col.key)
        if isinstance(v, datetime):
            v = v.isoformat()
        elif isinstance(v, Decimal):
            v = float(v)
        out[col.key] = v
    return out


async def all_settings(db: AsyncSession) -> dict:
    rows = (await db.execute(select(SiteSetting))).scalars().all()
    merged = {k: (v.copy() if isinstance(v, dict) else v) for k, v in DEFAULT_SETTINGS.items()}
    for r in rows:
        if isinstance(merged.get(r.key), dict) and isinstance(r.value, dict):
            merged[r.key] = {**merged[r.key], **r.value}
        else:
            merged[r.key] = r.value
    return merged


async def put_settings(db: AsyncSession, patch: dict) -> dict:
    for k, v in patch.items():
        if k not in DEFAULT_SETTINGS:
            continue
        row = await db.get(SiteSetting, k)
        if row is None:
            db.add(SiteSetting(key=k, value=v))
        else:
            row.value = v
    await db.commit()
    return await all_settings(db)
