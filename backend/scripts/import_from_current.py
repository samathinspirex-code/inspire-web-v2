"""Fill the NEW database with content.

Sources (read-only, nothing is written back):
  1. design-source/website/design-data.json  - the new design's built-in courses, stories, leaders, FAQs, campaigns
  2. the current site's PUBLIC API (GET only)  - all courses, details, fees, testimonials, news

Courses that exist in the design keep the design's look (image, wording) plus the real entry requirements,
topics and outcomes. Every other current course is added with its real data. Safe to re-run: it updates by key/slug.
Run:  python scripts/import_from_current.py  [--only-missing] [--snapshot data/current-snapshot]
      --snapshot reads saved JSON (courses.json, testimonials.json, news.json) instead of calling the API.
"""
import asyncio
import json
import re
import sys
from datetime import datetime
from pathlib import Path

import _bootstrap  # noqa: F401
import httpx
from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal, create_all
from app.modules.content.models import Campaign, Course, Faq, Leader, News, SiteSetting, Testimonial

ROOT = Path(__file__).resolve().parents[2]
DESIGN = ROOT / "design-source" / "website"
ONLY_MISSING = "--only-missing" in sys.argv
SNAPSHOT = Path(sys.argv[sys.argv.index("--snapshot") + 1]) if "--snapshot" in sys.argv else None

# Design key -> current site slug
KEY_TO_SLUG = {
    "hnd-se": "hnd-in-computing-software-engineering-software-developer-pathway",
    "hnd-ai": "hnd-in-artificial-intelligence",
    "hnd-cyber": "hnd-in-computing-cyber-security-technologist-pathway",
    "hnd-data": "hnd-in-computing-data-analytics-data-technologist-pathway",
    "hnd-net": "hnd-in-computing-netdevops-engineer-pathway",
    "hnd-acc": "hnd-in-accounting",
    "f-idt": "foundation-in-information-digital-technologies",
    "f-bus": "foundation-in-business-management",
    "f-acc": "foundation-in-accounting",
    "f-stat": "foundation-in-applied-statistics",
    "f-eng": "foundation-in-english-communications-for-business",
    "f-sme": "foundation-in-small-business-social-enterprise-start-up",
    "pg-edu": "postgraduate-diploma-in-strategic-educational-leadership-and-management",
    "pg-ai": "postgraduate-diploma-in-computing-artificial-intelligence",
    "pg-gen": "postgraduate-diploma-in-computing-general-route",
    "pg-se": "postgraduate-diploma-in-computing-software-engineering",
    "pg-app": "postgraduate-diploma-in-computing-application-development",
    "pg-data": "postgraduate-diploma-in-computing-data-analytics",
    "tu-beng": "uob-beng-hons-software-engineering-top-up",
    "tu-fin": "top-up-degree-in-management-finance-pathway",
    "tu-gen": "top-up-degree-in-management-general-route",
    "tu-people": "top-up-degree-in-management-managing-people-pathway",
    "tu-ops": "top-up-degree-in-management-operations-management-pathway",
    "tu-sales": "top-up-degree-in-management-sales-marketing-pathway",
    "c-aimastery": "ai-mastery",
    "c-aihr": "ai-for-hr-cpd",
    "c-aimkt": "ai-for-marketing",
    "c-cyber": "cyber-security-in-the-ai-era-short-course-cpd",
    "c-looker": "data-analytics-with-google-looker-studio-cpd",
    "c-dm": "digital-marketing-analytics-essentials",
}
SLUG_TO_KEY = {v: k for k, v in KEY_TO_SLUG.items()}

LEVEL = {"HND": "HND", "Foundation": "Foundation", "Postgraduate": "Postgraduate", "MBA": "Postgraduate", "MCA": "Postgraduate",
         "Top-Up": "Top-Up", "BCA": "Top-Up", "BBA": "Top-Up", "B.COM": "Top-Up", "Short Courses": "Short course",
         "Advanced Diploma": "HND", "Higher Diploma": "HND", "Diploma": "Foundation"}
PLAN = {"HND": "hnd", "Foundation": "fnd", "Short course": "cpd"}


def load_design():
    data = json.loads((DESIGN / "design-data.json").read_text(encoding="utf-8"))
    assets = json.loads((DESIGN / "manifest.json").read_text(encoding="utf-8"))["assets"]

    def fix(v):  # /_blob/<id> -> /assets/<file>
        if isinstance(v, str):
            return re.sub(r"/_blob/([a-f0-9]{32})", lambda m: "/assets/" + assets.get(m.group(1), m.group(1)), v)
        if isinstance(v, list):
            return [fix(x) for x in v]
        if isinstance(v, dict):
            return {k: fix(x) for k, x in v.items()}
        return v

    return fix(data)


def lkr(n: int) -> str:
    return f"LKR {n:,}"


def clean(s: str | None) -> str:
    return re.sub(r"\s+", " ", (s or "").replace("\t", " ")).strip()


def paragraphs(s: str | None) -> list[str]:
    return [clean(p) for p in (s or "").split("\n") if clean(p)]


def study(c: dict) -> tuple[int, str]:
    opts = [o for o in (c.get("study_options") or []) if o.get("is_enabled")]
    prices = [int(o["price"]) for o in opts if o.get("price")]
    dur = next((o.get("duration") for o in opts if o.get("duration")), "") or ""
    return (min(prices) if prices else 0), dur


def real_detail(c: dict) -> dict:
    """Fields we always take from the current site (real admissions info)."""
    out = {}
    entry = paragraphs(c.get("entry_requirements"))
    if entry:
        out["entry"] = " · ".join(entry)
    if c.get("progression_route"):
        out["progression"] = clean(c["progression_route"])
    return out


PRESETS = {
    "HND": dict(whoTitle="For builders and problem-solvers.", who=["School leavers after O/Ls or A/Ls", "Career changers", "Working learners", "Future degree students"],
                cups="48 free coffees a year", feeTitle="Plan your diploma with an advisor.", path_next="UK top-up degree"),
    "Foundation": dict(whoTitle="For your first step after O/Ls.", who=["Students who have finished O/Ls", "Learners who want a head start", "Anyone planning an HND or degree", "Career starters"],
                       cups="32 free coffees over 8 months", feeTitle="UK qualifications with monthly plans.", path_next="Level 4 diploma or HND"),
    "Top-Up": dict(whoTitle="For graduates ready to finish a degree.", who=["HND graduates", "Working professionals with a Level 5", "Learners after a recognised diploma", "Future managers"],
                   cups="40 free coffees", feeTitle="Finish your degree online.", path_next="Master's"),
    "Postgraduate": dict(whoTitle="For professionals ready to go further.", who=["Graduates", "Experienced professionals", "Managers and team leads", "Career switchers"],
                         cups="40 free coffees", feeTitle="Invest in your next level.", path_next="Senior and specialist roles"),
    "Short course": dict(whoTitle="For professionals who want skills fast.", who=["Working professionals", "Managers and team leads", "Entrepreneurs", "Students adding a skill"],
                         cups="4 free coffees in your first month", feeTitle="One clear fee.", path_next="Apply it at work"),
}


def plan_fees(c: dict, fee_head: str, dur: str) -> list:
    cards = ((c.get("payment_plans") or {}).get("cards") or []) if c.get("payment_plans_enabled") else []
    out = []
    for card in cards:
        rows = [[clean(r.get("label")), clean(r.get("amount"))] for r in card.get("rows") or [] if r.get("label")]
        if rows:
            out.append({"h": clean(card.get("title") or card.get("heading") or "Programme fee"), "rows": rows})
    return out or [{"h": "Programme fee", "rows": [["Fee", fee_head], ["Duration", dur or "Ask an advisor"], ["Payment plan", "Set with an advisor"]]}]


def new_course_detail(c: dict, level: str, plan: str, short: str, fee: int, dur: str) -> dict:
    """A complete Program-page object (same fields as the design's own courses)."""
    paras = paragraphs(c.get("blurb"))
    topics = [clean(t["topic"]) for t in sorted(c.get("topics") or [], key=lambda t: t.get("order", 0))]
    units = [t for t in topics if not re.match(r"^(year|level)\s*\d", t, re.I)]
    outcomes = [clean(o["outcome"]) for o in sorted(c.get("outcomes") or [], key=lambda o: o.get("order", 0))]
    pre = PRESETS.get(level, PRESETS["Short course"])
    monthly = int(c.get("monthly_instalment") or 0)
    fee_head = ("from " + lkr(fee) if level != "Short course" else lkr(fee)) if fee else "Talk to an advisor"
    d = {
        "lvl": level, "plan": plan, "short": short, "name": clean(c.get("title")),
        "qual": clean((c.get("subtitle") or "").split("|")[-1]) or level, "body": clean(c.get("awarding_body")) or "UK-regulated",
        "img": c.get("image_url") or "", "alt": clean(c.get("title")), "chip": clean(c.get("awarding_body")) or level,
        "blurb": paras[0] if paras else "", "overview": " ".join(paras[1:3]) if len(paras) > 1 else (paras[0] if paras else ""),
        "years": [["Focus", units[0] if units else short], ["Format", "Live online sessions plus the Inspire Brain LMS."]],
        "skills": units[:6] or [short], "careers": outcomes[:5] or ["Talk to an advisor about career routes"],
        "dur": dur or "Ask an advisor", "fee": fee, "feeHead": fee_head,
        "offer": bool(c.get("limited_offer_enabled") and monthly),
        "monthTrust": f"From LKR {monthly:,} a month" if monthly else "Monthly plans available",
        "startAmt": f"LKR {monthly:,} / month" if monthly else fee_head,
        "startNote": "after registration" if monthly else "Payment plan set with an advisor",
        "fees": plan_fees(c, fee_head, dur), "feeTitle": pre["feeTitle"],
        "feeNote": "Payment plans are set with an advisor. Contact admissions for entry requirements.",
        "who": pre["who"], "whoTitle": pre["whoTitle"], "cups": pre["cups"],
        "entry": "Contact admissions for entry requirements.",
        "path": [["Today", "Where you are now"], ["You are here", short], ["Next", pre["path_next"]], ["Then", "Your next career step"]],
        "finalLine": "Talk to an advisor about your plan." if not fee else "Reserve your seat today.",
    }
    return {**d, **real_detail(c)}


async def fetch(client: httpx.AsyncClient, path: str):
    r = await client.get(settings.CURRENT_API_URL.rstrip("/") + path, timeout=30)
    r.raise_for_status()
    j = r.json()
    return j.get("data", j) if isinstance(j, dict) else j


async def upsert(db, model, where, values: dict):
    obj = (await db.execute(select(model).filter_by(**where))).scalar_one_or_none()
    if obj and ONLY_MISSING:
        return obj, False
    if not obj:
        obj = model(**where)
        db.add(obj)
    for k, v in values.items():
        setattr(obj, k, v)
    return obj, True


async def main() -> None:
    await create_all()
    design = load_design()
    if SNAPSHOT:
        def read(name):
            j = json.loads((SNAPSHOT / name).read_text(encoding="utf-8"))
            return j.get("data", j) if isinstance(j, dict) else j
        current, testimonials, news = read("courses.json"), read("testimonials.json"), read("news.json")
    else:
        async with httpx.AsyncClient(headers={"User-Agent": "inspire-web-v2-import"}) as client:
            current = await fetch(client, "/api/v1/public/catalogue/courses")
            testimonials = await fetch(client, "/api/v1/public/testimonials")
            news = await fetch(client, "/api/v1/public/news-events")
    print(f"Current site: {len(current)} courses, {len(testimonials)} testimonials, {len(news)} news")

    cat, details = design["IC_CAT"], design["DETAIL"]
    cards = {c["img"]: c for c in design["CARDS"]}
    card_order = [c["img"] for c in design["CARDS"]]
    by_slug = {c["slug"]: c for c in current}

    async with SessionLocal() as db:
        n = 0
        for i, c in enumerate(current):
            slug = c["slug"]
            key = SLUG_TO_KEY.get(slug, slug)
            fee, dur = study(c)
            src = {k: c.get(k) for k in ("course_id", "title", "subtitle", "awarding_body", "entry_requirements", "progression_route", "blurb",
                                         "image_url", "programme_name", "school_name", "payment_plans", "monthly_instalment", "limited_offer_label",
                                         "topics", "outcomes", "study_options")}
            school = clean((c.get("school_name") or "").replace("School of ", ""))
            seo_desc = (paragraphs(c.get("blurb")) or [""])[0][:300]
            if key in cat:  # course drawn in the design: design layout + fee tables, current site's details and banner
                ic, det = cat[key], dict(details.get(key, {}))
                card = cards.get(ic["i"], {})
                cur = new_course_detail(c, ic["l"], ic["p"], ic["s"], fee, dur)
                for k in ("name", "qual", "img", "alt", "blurb", "overview", "skills", "careers", "entry", "progression"):
                    if cur.get(k):
                        det[k] = cur[k]
                if dur:
                    det["dur"] = dur
                if fee:
                    det["fee"], det["feeHead"] = fee, cur["feeHead"]
                if card:
                    det["card_name"] = card["name"]
                fee_label = (lkr(fee) if ic["p"] == "cpd" else "from " + lkr(fee)) if fee else ic["f"]
                values = dict(
                    slug=slug, title=clean(c.get("title")) or ic["n"], short=ic["s"], level=ic["l"], school=card.get("school") or school, body=ic["b"],
                    plan_type=ic["p"], duration=dur or ic["d"], fee=int(fee or det.get("fee") or 0), fee_label=fee_label,
                    monthly_label=card.get("monthly", ""), cpd_addon_fee=design["IC_CPDFEE"].get(key), image=c.get("image_url") or ic["i"],
                    blurb=cur.get("blurb") or card.get("blurb") or det.get("blurb", ""), keywords=card.get("k", ""), card_type=card.get("type", ""),
                    featured=bool(card), sort_order=card_order.index(ic["i"]) if card else 100 + i, status="published",
                    detail=det, source=src, seo_title=clean(c.get("title")), seo_description=seo_desc,
                )
            else:
                level = LEVEL.get(c.get("programme_name") or "", "Short course")
                plan = PLAN.get(level, "pg") if (level != "Foundation" or fee == 49500) else "pg"
                short = clean(c.get("title")).replace("-Level Study in", "").replace("Postgraduate-Level Study in", "PG ·")[:80]
                monthly = c.get("monthly_instalment")
                values = dict(
                    slug=slug, title=clean(c.get("title")), short=short, level=level, school=school,
                    body=clean(c.get("awarding_body")) or school, plan_type=plan,
                    duration=dur, fee=fee, fee_label=("from " + lkr(fee)) if fee else "Talk to an advisor",
                    monthly_label=f"or LKR {int(monthly):,} a month" if monthly else "", image=c.get("image_url") or "",
                    blurb=(paragraphs(c.get("blurb")) or [""])[0], keywords=" ".join({level.lower(), school.lower()}),
                    card_type=level, featured=False, sort_order=100 + i, status="published",
                    detail=new_course_detail(c, level, plan, short, fee, dur), source=src,
                    seo_title=clean(c.get("title")), seo_description=seo_desc,
                )
            await upsert(db, Course, {"key": key}, values)
            n += 1
        missing = [k for k, s in KEY_TO_SLUG.items() if s not in by_slug]
        if missing:
            print("Design courses not on the current site (skipped):", missing)

        # Stories: design picture + the current site's video and caption
        tmap = {clean(t["name"]).lower(): t for t in testimonials}
        for i, (name, role, img, pos) in enumerate(design["STORIES"]):
            t = tmap.get(name.lower(), {})
            await upsert(db, Testimonial, {"name": name}, dict(role=role, image=img, image_pos=pos, video_url=t.get("video_url") or "",
                                                              caption=clean(t.get("caption")), sort_order=i, status="published"))
        for i, (name, role, ini) in enumerate(design["LEADERS"]):
            await upsert(db, Leader, {"name": name}, dict(role=role, initials=ini, sort_order=i, status="published"))
        for aud, rows in (("student", design["FAQ"]), ("parent", design["FAQP"])):
            for i, (q, a) in enumerate(rows):
                await upsert(db, Faq, {"audience": aud, "question": q}, dict(answer=a, sort_order=i, status="published"))
        for i, (k, v) in enumerate(design["IC_CAMP"].items()):
            await upsert(db, Campaign, {"key": k}, dict(tag=v["tag"], text=v["text"], short=v["short"], perk=v["perk"], sort_order=i, status="published"))
        for i, item in enumerate(news):
            body = item.get("content")
            body = "\n\n".join(body) if isinstance(body, list) else (body or "")
            pub = item.get("published_at") or item.get("event_date") or item.get("created_at")
            await upsert(db, News, {"slug": item["slug"]}, dict(
                title=clean(item.get("title")), excerpt=clean(item.get("excerpt")), body=body, category=item.get("category") or item.get("kind") or "News",
                image=item.get("image_url") or "", video_url=item.get("video_url") or "", sort_order=i, status="published",
                published_at=datetime.fromisoformat(pub.replace("Z", "+00:00")) if pub else None, source={"news_event_id": item.get("news_event_id")},
            ))
        extra = [c for c in design["CARDS"] if c["img"] not in {x["i"] for x in cat.values()}]
        if extra and not await db.get(SiteSetting, "home_extra_cards"):
            for c in extra:
                c["href"] = "/programs?school=Jain%20University" if "Jain" in c["name"] else "/programs"
            db.add(SiteSetting(key="home_extra_cards", value=extra))
        await db.commit()
    print(f"Imported {n} courses, {len(design['STORIES'])} stories, {len(design['LEADERS'])} leaders, "
          f"{len(design['FAQ']) + len(design['FAQP'])} FAQs, {len(design['IC_CAMP'])} campaigns, {len(news)} news.")


asyncio.run(main())
