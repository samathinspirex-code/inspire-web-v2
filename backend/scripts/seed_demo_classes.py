"""Add sample classes to the demo LMS "My Classes" (only when there are none yet; edit them later in the CMS).

  python scripts/seed_demo_classes.py
"""
import asyncio
from datetime import date

import _bootstrap  # noqa: F401
from sqlalchemy import func, select

from app.core.database import SessionLocal, create_all
from app.modules.content.models import Course
from app.modules.demo.models import DemoClass

# (code, title, awarding body, school, programme, intake, mode, start, end, lecturers, status, course key for the banner)
CLASSES = [
    ("C_L4_U1", "Programming", "ATHE (UK)", "School of Computing", "HND · Software Engineering", "September", "Full Time",
     date(2026, 9, 1), date(2026, 12, 15), "Ruwan Silva, Nishadie Gunathilaka", "Active", "hnd-se"),
    ("C_L4_U3", "Networking", "ATHE (UK)", "School of Computing", "HND · Cyber Security", "September", "Full Time",
     date(2026, 9, 8), date(2026, 12, 20), "Kasun Perera", "Active", "hnd-cyber"),
    ("C_L4_U6", "Network Security", "ATHE (UK)", "School of Computing", "HND · Cyber Security", "November", "Part Time",
     date(2026, 11, 23), date(2027, 1, 2), "Kasun Perera, Ruwan Silva, Nishadie Gunathilaka", "Planned", "hnd-cyber"),
    ("C_L4_U9", "Machine Learning Foundations", "ATHE (UK)", "School of Computing", "HND · Computing & AI", "September", "Full Time",
     date(2026, 9, 1), date(2027, 1, 10), "Nishadie Gunathilaka", "Active", "hnd-ai"),
    ("B_L3_M5", "Market Research", "ATHE (UK)", "School of Business", "Foundation · Business", "September", "Full Time",
     date(2026, 9, 1), date(2026, 11, 1), "Leandra Joseph", "Active", "f-bus"),
    ("B_L4_U2", "Managing Finance", "ATHE (UK)", "School of Business", "HND · Accounting & Finance", "September", "Part Time",
     date(2026, 9, 15), date(2027, 1, 30), "Leandra Joseph, Tharindu Fernando", "Active", "hnd-acc"),
    ("CPD_AI_01", "AI Mastery: Prompting & Automation", "CPD UK", "School of CPD", "AI Mastery", "November", "Part Time",
     date(2026, 11, 10), date(2027, 2, 2), "Dinesh Kumara", "Active", "c-aimastery"),
    ("CPD_DM_01", "Digital Marketing & Analytics", "CPD UK", "School of CPD", "Digital Marketing & Analytics Essentials", "December", "Part Time",
     date(2026, 12, 7), date(2027, 1, 4), "Leandra Joseph", "Planned", "c-dm"),
]


async def main() -> None:
    await create_all()
    async with SessionLocal() as db:
        if (await db.execute(select(func.count()).select_from(DemoClass))).scalar_one():
            print("Demo classes already exist; nothing added. Edit them in the CMS (Demo LMS classes).")
            return
        images = {c.key: c.image for c in (await db.execute(select(Course))).scalars()}
        for i, (code, title, body, school, prog, intake, mode, start, end, lect, status, key) in enumerate(CLASSES):
            db.add(DemoClass(code=code, title=title, awarding_body=body, school=school, programme=prog, intake=intake, study_mode=mode,
                             start_date=start, end_date=end, lecturers=lect, status=status, image=images.get(key, ""),
                             description=f"{title} for {prog}.", sort_order=(i + 1) * 10, published="published"))
        await db.commit()
        print(f"Added {len(CLASSES)} demo classes.")


if __name__ == "__main__":
    asyncio.run(main())
