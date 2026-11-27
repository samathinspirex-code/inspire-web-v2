# AGENTS.md — Inspire Web v2

Guide for AI coding agents (Claude Code, Cursor, Codex…) working in this repo. Read this before changing anything.

## What this is

The new Inspire College website: new design, a free-demo LMS with Live Campus (`/portal`), online enrolment with PayHere
checkout, monthly instalment invoices and bank-slip upload (`/pay/<token>`).

It has **no backend and no CMS of its own** any more. Everything comes from the shared Inspire API (`inspire-api-host`,
AWS, `https://api.inspirecollege.lk`) — the same backend as the CMS, CRM and LMS — and is managed in the current CMS
(`CMS-UI`):

| On the website | Managed in CMS-UI | API (inspire-api-host) |
|---|---|---|
| Course names, banners, prices, entry requirements, topics | Academic Structure | `academic_courses` |
| How a course is listed (design key, card text, fee plan type, home grid, programme page text) | New Website → Course listings | `website_courses` |
| FAQs, offers, contact numbers, theme, tracking, HND/Foundation fee plans, story photos | New Website | `website_faqs`, `website_campaigns`, `website_settings` |
| News, testimonials (video/caption), home hero, bottom banner, top strip, Christmas theme | News & Events, Testimonials, Website Settings | existing CMS tables |
| Demo LMS classes and their content, demo accounts | Demo LMS | `web_demo_*` |
| Website orders, bank slips, plans, HND Year 2, bank details | Payments → Website Payments | `payments.web_orders`, `bank_slips`, `web_enrolments` + the Accounts ledger |
| Leads from forms, checkout and demo sign-up | CRM (source "New website") | `crm_leads` |

Leaders (`src/lib/leaders.ts`) and old-link redirects (`next.config.ts`, `src/lib/redirects.ts`, `src/lib/legacySlugs.ts`)
are fixed in this repo on purpose.

```
inspire-web-v2/
  design-source/   original design files + extracted pages/assets/data (reference only, never served)
  frontend/        Next.js 16 / React 19 — website, /portal demo LMS, /pay invoice page   :3110
```

## Hosting

| Part | Where | Deploys |
|---|---|---|
| Website | Vercel, team InspireX, project `inspire-web-v2`, root `frontend/`, region `sin1` → https://inspire-web-v2.vercel.app | Automatically on push to `main` |
| API | `inspire-api-host` on AWS Lightsail (`api.inspirecollege.lk`) | Deployed from that repo (see its docs) |

- Some pages are pre-built at deploy time from the API bundle, so the API (with `WEB_API_ENABLED=true`) must be live
  before the website builds.
- The preview is hidden from search engines (`SITE_NOINDEX=1` on Vercel). Remove it only when this replaces inspirecollege.lk.
- Card payments open PayHere from the API's own address (`/pay/web/<token>/go`), which is the domain approved with PayHere.

## Running locally

```powershell
cd frontend; npm run dev        # frontend/.env.local: BACKEND_URL (an Inspire API), WEB_PROXY_SECRET, NEXT_PUBLIC_SITE_URL
```
Checks before you finish: `npx tsc --noEmit; npx next build` (the build needs a reachable API with the website routes on).

## How the frontend works (important)

- **Design pages are served as raw HTML**, not React. `src/site/pages/*.html` are **generated** — do not edit them by hand.
  Edit the patch in `frontend/scripts/prepare-design.mjs`, then run `npm run prepare-design`. Each patch is a checked string
  replacement that throws if it no longer matches.
- The pages use the design's own small "DC" template framework. It re-renders often and **resets DOM attributes set from
  outside**, so keep UI state in the page state, not in attributes added with JavaScript.
- Page data comes from `GET /api/v1/public/web/bundle` (API caches 60 s, Next revalidates 60 s) as `window.IC_DATA`
  (`src/lib/site-data.ts`). The API builds each course's programme page from the catalogue course plus its website listing,
  so a course always has every field the page reads.
- Shared runtime: `src/site/runtime.js` (routing, orders/PayHere, leads incl. the checkout lead draft, demo, Live feed,
  theme). Demo LMS runtime: `src/site/portal.js`. Global CSS overrides: `BANNER_FIT` in `src/lib/render.ts`.
- Browser → API always goes through same-origin Next routes in `src/app/api/**` (`src/lib/proxy.ts`). They convert API
  errors (`{error:{message}}`) to `{detail}` and send `X-Web-Proxy-Key` + `X-Web-Visitor-IP` so the API rate-limits per
  visitor. The demo token lives in an httpOnly cookie.
- Bank slips: the browser uploads a file to `/api/pay/<token>/slip`; the route converts it to JSON for the API (max 4 MB,
  Vercel's body limit).

## Payments (agreed rules — don't change without the user)

- The API prices everything; the browser never sets an amount.
- An order is a price snapshot only. Learner, enrolment, invoices and receipts are created in the Accounts ledger at the
  first verified PayHere payment or approved bank slip.
- Monthly plans: month 1 is due one month after the registration payment, then the same day each month. Only courses with
  Automatic instalments on. The existing Accounts daily job issues each invoice 5 days before it is due and sends reminders
  3 days before / on the day / 7 days after; links point to this site's `/pay/<token>`.
- HND Year 2, reservations and advisor plans: finance uses Payments → Website Payments.
- A paid order updates the CRM lead (payment, stage Enrolled). Leads start when name, email and phone are entered at checkout.

## Safety rules

- Never commit secrets: `frontend/.env.local` is git-ignored. The repo is **public**, so double-check every commit.
- Never enter passwords, API keys or card details into websites on the user's behalf.
- Website test records on the live API use names starting "ZZ TEST"; journals and payments are never deleted (finance
  reverses them).
- Commit/push only when asked.
