import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import BASE_DIR, settings
from app.core.database import SessionLocal, create_all
from app.modules.admin_auth.router import router as admin_auth_router
from app.modules.content.admin_router import router as admin_router
from app.modules.content.public_router import router as public_router
from app.modules.demo.router import router as demo_router
from app.modules.demo.service import purge_expired
from app.modules.demo.studio_router import router as demo_studio_router
from app.modules.leads.router import router as leads_router
from app.modules.live.router import router as live_router
from app.modules.payments.admin_router import router as payments_admin_router
from app.modules.payments.jobs import run_billing
from app.modules.payments.router import router as payments_router

log = logging.getLogger("inspire-web-v2")


async def _purge_loop() -> None:
    """Deletes demo accounts older than DEMO_TTL_HOURS, every few minutes."""
    while True:
        try:
            async with SessionLocal() as db:
                n = await purge_expired(db)
                if n:
                    log.info("Purged %s expired demo account(s)", n)
        except Exception:  # keep the loop alive; next run retries
            log.exception("Demo purge failed")
        await asyncio.sleep(settings.DEMO_PURGE_EVERY_MINUTES * 60)


async def _billing_loop() -> None:
    """Issues upcoming instalment invoices, sends reminders and queued emails (see payments/jobs.py)."""
    await asyncio.sleep(20)
    while True:
        try:
            async with SessionLocal() as db:
                res = await run_billing(db)
                if res.get("issued") or res.get("reminders") or (res.get("email") or {}).get("sent"):
                    log.info("Billing run: %s", res)
        except Exception:  # keep the loop alive; next run retries
            log.exception("Billing run failed")
        await asyncio.sleep(settings.BILLING_EVERY_MINUTES * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.is_sqlite:
        (BASE_DIR / "data").mkdir(exist_ok=True)
        await create_all()  # local dev convenience; servers run scripts/init_db.py
    tasks = [asyncio.create_task(_purge_loop()), asyncio.create_task(_billing_loop())]
    yield
    for task in tasks:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

for r in (public_router, leads_router, payments_router, demo_router, live_router, admin_auth_router, admin_router, payments_admin_router, demo_studio_router):
    app.include_router(r)

Path(settings.MEDIA_DIR).mkdir(parents=True, exist_ok=True)
app.mount(settings.MEDIA_PUBLIC_PATH, StaticFiles(directory=settings.MEDIA_DIR), name="media")


@app.get("/health")
async def health():
    return {"ok": True, "env": settings.ENVIRONMENT}
