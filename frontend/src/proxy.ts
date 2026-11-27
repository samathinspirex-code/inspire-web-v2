// 1) 410 Gone for leftover WordPress / old-LMS URLs (same list as the current site).
// Old-link redirects are fixed in code: next.config.ts / lib/redirects.ts.
import { NextResponse, type NextRequest } from "next/server";

const GONE = [
  /^\/dtlms_/, /^\/classes(\/|$)/, /^\/category\//, /^\/tag\//, /^\/author\//, /^\/courses(\/|$)/,
  /^\/wp-content\//, /^\/wp-admin/, /^\/wp-json/, /^\/wp-login\.php/, /^\/xmlrpc\.php/, /\/feed\/?$/,
  /^\/shop\/?$/, /^\/my-account/, /^\/cart\/?$/, /^\/checkout/,
];

export function proxy(request: NextRequest) {
  const p = request.nextUrl.pathname;
  if (GONE.some((re) => re.test(p))) {
    return new NextResponse("This page has been permanently removed.", {
      status: 410, headers: { "X-Robots-Tag": "noindex", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: never assets, Next internals or API routes.
  matcher: ["/((?!_next/|api/|assets/|testimonials/|favicon.ico|icon.png|apple-icon.png|robots.txt|sitemap.xml).*)"],
};
