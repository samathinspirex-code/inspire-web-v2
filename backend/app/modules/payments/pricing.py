"""Server-side fee plans (the design's icPlans). The browser never decides the amount.

Each plan carries display text (t, d, a, u, then) plus billing terms used to build the instalment schedule:
  code: monthly | full | reserve, today: due at enrolment, instalments + instalment_amount (monthly plans).
"""
from app.modules.content.models import Course

# Defaults match the design / current fee schedule. Admins can override them in Website settings -> fee_plans.
DEFAULT_FEE_PLANS = {
    "hnd": [
        {"t": "Monthly · start with LKR 9,999", "d": "LKR 10,000 registration today, then 9 × LKR 9,999 in Year 1", "a": "LKR 9,999", "u": "a month", "today": 10000, "then": "9 × LKR 9,999 (Year 1)", "hot": True,
         "code": "monthly", "instalments": 9, "instalment_amount": 9999},
        {"t": "Pay Year 1 in full", "d": "One payment for Year 1. Year 2 billed later.", "a": "LKR 99,900", "u": "Year 1", "today": 99900, "then": "Year 2 billed later",
         "code": "full"},
        {"t": "Just reserve my seat", "d": "Pay registration now, choose your plan with an advisor", "a": "LKR 10,000", "u": "registration", "today": 10000, "then": "Plan set with an advisor",
         "code": "reserve"},
    ],
    "fnd": [
        {"t": "Monthly · LKR 5,000", "d": "LKR 9,500 registration today, then 8 × LKR 5,000", "a": "LKR 5,000", "u": "a month", "today": 9500, "then": "8 × LKR 5,000", "hot": True,
         "code": "monthly", "instalments": 8, "instalment_amount": 5000},
        {"t": "Pay in full", "d": "One payment, done", "a": "LKR 49,500", "u": "total", "today": 49500, "then": "Nothing more", "code": "full"},
        {"t": "Just reserve my seat", "d": "Pay registration now, start when ready", "a": "LKR 9,500", "u": "registration", "today": 9500, "then": "Plan set with an advisor", "code": "reserve"},
    ],
}


def lkr(n) -> str:
    return f"LKR {round(float(n or 0)):,}"


def plans_for(course: Course, fee_plans: dict | None = None) -> list[dict]:
    table = {**DEFAULT_FEE_PLANS, **(fee_plans or {})}
    if course.plan_type in ("hnd", "fnd") and table.get(course.plan_type):
        return table[course.plan_type]
    fee = int(course.fee or 0)
    if course.plan_type == "cpd":
        return [
            {"t": "Pay in full", "d": "Your seat in the next cohort", "a": lkr(fee), "u": "total", "today": fee, "then": "Nothing more", "hot": True, "code": "full"},
            {"t": "Reserve my seat", "d": "Hold a seat, pay before the cohort starts", "a": "LKR 0", "u": "today", "today": 0, "then": "Pay before the cohort starts", "code": "reserve"},
        ]
    return [
        {"t": "Reserve my seat", "d": "No payment today. An advisor sets your monthly plan.", "a": "LKR 0", "u": "today", "today": 0, "then": "Monthly plan set with an advisor", "hot": True, "code": "reserve"},
        {"t": "Pay in full", "d": "One payment", "a": lkr(fee), "u": "total", "today": fee, "then": "Nothing more", "code": "full"},
    ]


def billing_terms(plan: dict, plan_type: str = "", index: int = 0) -> dict:
    """code / today / instalments / instalment_amount for a plan, filling gaps for plans edited without them."""
    code = plan.get("code")
    if code not in ("monthly", "full", "reserve"):
        u = str(plan.get("u", "")).lower()
        code = "monthly" if "month" in u else "reserve" if ("registration" in u or "today" in u) else "full"
    inst = int(plan.get("instalments") or 0)
    amt = int(plan.get("instalment_amount") or 0)
    if code == "monthly" and (not inst or not amt):
        for d in DEFAULT_FEE_PLANS.get(plan_type, []):
            if d.get("code") == "monthly":
                inst, amt = inst or d["instalments"], amt or d["instalment_amount"]
    return {"code": code, "today": int(plan.get("today") or 0), "instalments": inst if code == "monthly" else 0,
            "instalment_amount": amt if code == "monthly" else 0, "label": str(plan.get("t", ""))[:200]}


def addon_price(course: Course) -> int:
    """Extra CPD courses in the enrol drawer are 25% off."""
    return round((course.cpd_addon_fee or course.fee or 0) * 0.75)
