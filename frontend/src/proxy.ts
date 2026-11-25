// 1) 410 Gone for leftover WordPress / old-LMS URLs (same list as the current site).
// 2) Redirects added in the website CMS (/admin -> Redirects), read from the backend and cached for a minute.
import { NextResponse, type NextRequest } from "next/server";

const GONE = [
  /^\/dtlms_/, /^\/classes(\/|$)/, /^\/category\//, /^\/tag\//, /^\/author\//, /^\/courses(\/|$)/,
  /^\/wp-content\//, /^\/wp-admin/, /^\/wp-json/, /^\/wp-login\.php/, /^\/xmlrpc\.php/, /\/feed\/?$/,
  /^\/shop\/?$/, /^\/my-account/, /^\/cart\/?$/, /^\/checkout/,
];

type Rule = { source: string; destination: string; permanent: boolean; gone: boolean };
let rules: Rule[] = [];
let loadedAt = 0;

async function cmsRules(): Promise<Rule[]> {
  if (Date.now() - loadedAt < 60_000) return rules;
  loadedAt = Date.now();
  try {
    const base = (process.env.BACKEND_URL || "http://127.0.0.1:8120").replace(/\/$/, "");
    const r = await fetch(base + "/api/v1/public/redirects", { cache: "no-store" });
    if (r.ok) rules = await r.json();
  } catch {
    /* keep the last good list */
  }
  return rules;
}

export async function proxy(request: NextRequest) {
  const p = request.nextUrl.pathname;
  if (GONE.some((re) => re.test(p))) {
    return new NextResponse("This page has been permanently removed.", {
      status: 410, headers: { "X-Robots-Tag": "noindex", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const norm = p.length > 1 ? p.replace(/\/$/, "") : p;
  const rule = (await cmsRules()).find((r) => r.source === norm || r.source === p);
  if (rule) {
    if (rule.gone) return new NextResponse("This page has been permanently removed.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    if (rule.destination) return NextResponse.redirect(new URL(rule.destination, request.url), rule.permanent ? 308 : 307);
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: never assets, Next internals or API routes.
  matcher: ["/((?!_next/|api/|assets/|testimonials/|favicon.ico|icon.png|apple-icon.png|robots.txt|sitemap.xml).*)"],
};
