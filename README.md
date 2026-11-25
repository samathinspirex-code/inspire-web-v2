# Inspire Web v2

The new Inspire College website (new design), its own website CMS, a free-demo LMS with Live Campus, and PayHere checkout.
**Fully separate** from CMS-UI, LMS-UI, inspire-ui-host, inspire-api-host and the current database. Content was copied from the
current site's public API (read-only); nothing is written back.

```
inspire-web-v2/
  design-source/       the two original design files + pages/assets/data extracted from them (reference, never served)
  frontend/            Next.js 16 — website, /admin (CMS), /portal (demo LMS)          → http://localhost:3110
  backend/             FastAPI + SQLAlchemy — content, CMS API, orders/PayHere, demo   → http://localhost:8120
```

## How it fits together

| URL | What | Built from |
|---|---|---|
| `/`, `/about` | Home | design page **Main** |
| `/programs`, `/programs/<slug>`, `/hnd-courses`, `/business-degrees`, `/computing-degrees`, `/postgraduate-degrees`, `/short-courses` | Catalogue and programme pages (same slugs as the current site) | design page **Program** |
| `/free-demo` | Free demo sign-up → creates a demo account and opens the demo LMS | design page **Demo** |
| `/aptitude`, `/admissions`, `/brain`, `/live-campus` | AI match, application, Inspire Brain tour, Live Campus | **Aptitude**, **Enrol**, **LMS**, **Live** |
| `/contact`, `/news`, `/news/<slug>`, policies, `/payment/return` | Pages the design doesn't draw, styled with the design's own CSS | `src/lib/chrome.ts` |
| `/portal` | Demo LMS: dashboard if signed in to a demo account, otherwise `/portal/login` | **Inspire College OS** (student portal only) |
| `/portal/live-campus` | Live Campus inside the demo LMS, with real demo-student activity | **Live** |
| `/admin` | Website CMS | React (`src/admin`) |

* The design pages are served **as designed** (their own HTML/CSS/JS). `frontend/scripts/prepare-design.mjs` applies small,
  named patches (real URLs, CMS data, orders, demo sign-up, form fixes) and fails loudly if the design changes.
  Re-run with `npm run prepare-design` after replacing a design file in `design-source/`.
* Every page gets its data from `GET /api/v1/public/bundle` (cached 60 s), so CMS edits show within about a minute.
* **Sign-up form overlap fix:** the forms used class `stack`, which the home page and the colour-theme layer style as a purple
  card. Form wrappers are now `form-stack` on Demo, Program and Enrol.
* Redirects: the current site's tables are copied (`src/lib/redirects.ts`, `src/lib/legacySlugs.ts`, 410 list in `src/proxy.ts`);
  extra redirects can be added in the CMS.

## Demo accounts

Sign-up at `/free-demo` creates an account (`demo_users`, password hashed) that expires **24 hours** later. The demo LMS starts
with the design's sample data, personalised with the student's name, and every change is saved to the backend (`demo_states`).
New points become Live Campus events (`demo_events`, first name + initial only). Expired accounts and all their data are deleted
by the backend every 15 minutes and by `scripts/purge_demo.py` (server timer example in `backend/deploy/`).

## Payments

`backend/app/modules/payments/payhere.py` is the current backend's PayHere logic (same hash, signature check, duplicate/amount checks).
The browser never decides the amount: the server prices the plan (`pricing.py`, fee plans editable in the CMS). Only a verified
PayHere notify marks an order paid. Runs in **sandbox** until `PAYHERE_MODE=live` with live keys and a public HTTPS `PUBLIC_BASE_URL`.

## Run locally

```powershell
cd inspire-web-v2\backend
python -m venv .venv; .venv\Scripts\pip install -r requirements.txt
copy .env.example .env          # set JWT_SECRET; DATABASE_URL empty = local file DB
.venv\Scripts\python scripts\init_db.py
.venv\Scripts\python scripts\import_from_current.py          # or: --snapshot data\current-snapshot
.venv\Scripts\python scripts\create_admin.py you@example.com "Your Name"
.venv\Scripts\python -m uvicorn app.main:app --port 8120
```
```powershell
cd inspire-web-v2\frontend
npm install
copy .env.example .env.local
npm run dev                      # http://localhost:3110
```
Tests: `cd backend; .venv\Scripts\python -m pytest`

## Database (new Supabase project)

Put the **new** project's *Session pooler* URI in `backend/.env` → `DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`,
then run `init_db.py` and `import_from_current.py`. `init_db.py` refuses to run against the current production database.

## Before going live

* `PAYHERE_*` sandbox keys → test a card payment → live keys after a controlled real payment.
* Deploy the backend on its own (example units in `backend/deploy/`), set `PUBLIC_BASE_URL` (HTTPS), `CORS_ORIGINS`, `SITE_URL`.
* Deploy the frontend with `BACKEND_URL` and `NEXT_PUBLIC_SITE_URL`. Media uploads go to `backend/data/media` (use a separate bucket on the server).
