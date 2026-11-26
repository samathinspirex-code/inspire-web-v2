# AGENTS.md — Inspire Web v2

Guide for AI coding agents (Claude Code, Cursor, Codex…) working in this repo. Read this before changing anything.
Human-facing setup docs are in `README.md`.

## What this is

The new Inspire College website: new design, its own website CMS (`/admin`), a free-demo LMS with Live Campus (`/portal`),
and student payments (PayHere checkout, monthly instalment invoices, bank-slip upload, Mailjet emails).

It is **fully separate** from the current Inspire projects (CMS-UI, LMS-UI, inspire-ui-host, inspire-api-host) and from the
current database. Never point this project at the current API or database, and never write to them.
`backend/scripts/upgrade_db.py`, `backup_db.py` and `init_db.py` refuse the current Supabase project on purpose — keep that.

```
inspire-web-v2/
  design-source/   original design files + extracted pages/assets/data (reference only, never served)
  frontend/        Next.js 16 / React 19 — website, /admin CMS, /portal demo LMS, /pay invoice page   :3110
  backend/         FastAPI + SQLAlchemy 2 async — content, CMS API, demo, payments, billing job       :8120
  render.yaml      Render blueprint for the backend
```

## Hosting

| Part | Where | Deploys |
|---|---|---|
| Website | Vercel, team InspireX, project `inspire-web-v2`, root `frontend/`, region `sin1` → https://inspire-web-v2.vercel.app | Automatically on push to `main` |
| API | Render, service `inspire-web-v2-api` (free plan, Singapore) → https://inspire-web-v2-api.onrender.com | **Manual**: Render → Manual Deploy (deployed from the public repo URL, so no auto-deploy) |
| Database | Supabase (own project, Seoul session pooler) | `upgrade_db.py` runs on every API start |

- The preview is hidden from search engines (`SITE_NOINDEX=1` on Vercel). Remove it only when this replaces inspirecollege.lk.
- Free Render plan: the API sleeps after 15 min idle; there is no persistent disk, so uploaded slips/media are lost on redeploy.
  Before real payments: Starter plan + 1 GB disk (`MEDIA_DIR`/`SLIP_DIR` → `/var/data/...`), see comments in `render.yaml`.
- PayHere is in **sandbox** (merchant 1239041). Live keys are a deliberate go-live step, never a side effect.
- Emails are sent but redirected to `MAIL_TEST_TO` (enrol@inspire.college) while testing.

## Running locally

```powershell
# backend (needs backend/.env — copy .env.example; secrets are never committed)
cd backend; .venv\Scripts\python -m uvicorn app.main:app --port 8120
# frontend (frontend/.env.local: BACKEND_URL=http://127.0.0.1:8120, NEXT_PUBLIC_SITE_URL=http://localhost:3110)
cd frontend; npm run dev
```
Workspace launch configs `web-v2-backend` / `web-v2-frontend` exist in the parent folder's `.claude/launch.json`.

Checks before you finish:
```powershell
cd backend; .venv\Scripts\python -m pytest -q        # uses a throwaway SQLite DB with foreign keys on
cd frontend; npx tsc --noEmit; npx next build
```

## How the frontend works (important)

- **Design pages are served as raw HTML**, not React. `src/site/pages/*.html` are **generated** — do not edit them by hand.
  Edit the patch in `frontend/scripts/prepare-design.mjs`, then run `npm run prepare-design`. Each patch is a checked string
  replacement that throws if it no longer matches, so a design change fails loudly instead of breaking silently.
- The pages use the design's own small "DC" template framework (`{{…}}`, `<template data-sc="for|if">`, `DCLogic`).
  It re-renders often and **resets DOM attributes set from outside**, so keep UI state in the page state (patched into the
  component), not in attributes you add with JavaScript. Playback-only helpers (story videos) live in `src/site/runtime.js`.
- Page data comes from `GET /api/v1/public/bundle` (cached 60 s) as `window.IC_DATA` (`src/lib/site-data.ts`).
- Shared runtime: `src/site/runtime.js` (routing `icRoute`, orders/PayHere, leads, demo, AI-match details, Live feed, theme).
  Demo LMS runtime: `src/site/portal.js`. Global CSS overrides injected into design pages: `BANNER_FIT` in `src/lib/render.ts`.
- Pages the design doesn't draw (contact, news, policies, `/pay/<token>`, `/payment/return`) use `src/lib/chrome.ts`.
- `/admin` is React (`src/admin/`): `AdminApp.tsx`, CRUD schemas in `schemas.ts`, payments area in `Payments.tsx`.
- Browser → backend always goes through same-origin Next routes in `src/app/api/**` (`src/lib/proxy.ts`); admin and demo
  tokens live in httpOnly cookies. The browser never calls the backend directly.
- Course banners from the current site are 1450×750 (29:15) with text on them: boxes showing them use that ratio so nothing
  is cropped (`BANNER_FIT`, only for images on `cloudfront.net`; design photos keep their own framing).
- WhatsApp number comes from CMS settings (`__IC_WA_MAIN__` token replaced at render). Current number: +94 76 097 4225.

## How the backend works

- Modules in `backend/app/modules/`: `content` (courses, news, settings, CMS CRUD), `admin_auth`, `leads`, `demo`, `live`,
  `payments`. Config in `app/core/config.py` (everything from `backend/.env`).
- Schema changes: add the column/table to the model, then run `scripts/upgrade_db.py` (adds missing tables/columns only, never
  drops). `create_all` alone does not alter existing tables. Take a backup first: `scripts/backup_db.py`
  (restore: `--restore FILE [--replace]`).
- Postgres enforces foreign keys: flush a parent row before adding children that reference it (tests enforce this too).
- Demo accounts expire after 24 h (purge loop in `app/main.py`).

### Payments (agreed rules — don't change without the user)

- The server prices everything from the course's fee plan (`payments/pricing.py`); the browser never sets an amount.
- Enrol → student (`S1000+`) + enrolment + first invoice (`INV-10000+`, registration or full fee). Each invoice has a secret
  token → no-login page `/pay/<token>` (pay by card or upload a bank slip, see the schedule).
- Monthly plans: after the first payment, the whole schedule is created; month 1 is due **one month after the payment date**,
  then the same day each month, computed from that date (`billing.add_months`). Only for courses with **Automatic
  instalments** on (`Course.auto_instalments`).
- HND Year 2 is started by finance in the CMS. Reserved / advisor plans get their plan from finance (`set_plan`).
- Billing job (`payments/jobs.py`, every 15 min, Postgres advisory lock): issue invoices 5 days before due, reminders 3 days
  before / on the day / 7 days after. Every automatic email has a `dedupe_key` so it is sent once.
- PayHere: only a verified notify records a card payment (signature, amount, currency, duplicate checks). Never trust the
  return URL. Bank slips are private files (`SLIP_DIR`), approved or rejected by finance in the CMS.
- Emails go through the `messages` outbox (`payments/mailer.py`, Mailjet v3.1). `MAIL_ENABLED=false` keeps them queued;
  `MAIL_TEST_TO` redirects all of them. Outbound HTTPS uses the OS certificate store (`truststore`) for Windows/AV setups.

## Safety rules

- Never commit secrets: `backend/.env`, `frontend/.env.local`, `backend/data/`, `backend/backups/` are git-ignored. The repo is
  **public** right now, so double-check every commit.
- Never enter passwords, API keys or card details into websites on the user's behalf; ask the user to paste them.
- Don't delete real data. Test rows you create on the shared database must be removed afterwards; leave other people's rows
  (e.g. team members trying the site) alone.
- Commit/push only when asked. Commit messages end with the co-author line the session asks for.
- Keep the current inspirecollege.lk site and its repos untouched.

## Where to look

| Task | File |
|---|---|
| Change a design page | `frontend/scripts/prepare-design.mjs` → `npm run prepare-design` |
| CSS fixes on design pages | `BANNER_FIT` in `frontend/src/lib/render.ts` |
| Page data shape | `frontend/src/lib/site-data.ts`, backend `content/public_router.py` |
| CMS screens / fields | `frontend/src/admin/` (`schemas.ts` for content sections) |
| Fees and plans | `backend/app/modules/payments/pricing.py` (+ Website settings → Fee plans) |
| Instalments, invoices, reminders | `backend/app/modules/payments/billing.py`, `jobs.py` |
| Payment emails | `backend/app/modules/payments/templates.py` |
| Copy content from the current site | `backend/scripts/import_from_current.py` (read-only GETs to the current public API) |
