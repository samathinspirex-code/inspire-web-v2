// Pages the design does not draw (contact, news, policies, payment result) use the design's own CSS
// (taken from the prepared Demo page) with the same top bar, so they look like part of the same site.
import fs from "node:fs";
import path from "node:path";

import type { Bundle } from "./backend";
import { esc, htmlResponse, safeJson, seoTags, type Seo } from "./render";

let css: string | null = null;
function designCss(): string {
  if (css && process.env.NODE_ENV === "production") return css;
  const demo = fs.readFileSync(path.join(process.cwd(), "src", "site", "pages", "Demo.html"), "utf8");
  css = (demo.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join("");
  return css;
}

const EXTRA = `<style>
.cp .tbar nav{display:flex;gap:4px;margin-left:auto;align-items:center}
.cp .tbar nav a{padding:10px 14px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px}
.cp .tbar nav a:hover{background:var(--soft)}
.cp .tbar nav a.cta{background:var(--act);color:#fff}
.cp .page{max-width:880px;margin:0 auto}
.cp .eyebrow{display:inline-flex;gap:8px;align-items:center;color:var(--act-ink);font-weight:650;font-size:13px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px}
.cp h1{font-size:clamp(36px,5vw,58px);margin:0 0 14px}
.cp h2{font-size:clamp(22px,2.4vw,28px);margin:34px 0 10px}
.cp .lead{font-size:18px;color:var(--muted)}
.cp .card{background:var(--card);border:1px solid var(--line);border-radius:32px;padding:clamp(20px,3vw,32px);box-shadow:var(--shadow)}
.cp .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr));gap:16px}
.cp .news a{text-decoration:none;display:flex;flex-direction:column;gap:10px;height:100%}
.cp .news img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:22px;background:var(--soft)}
.news .nt{font-size:19px;line-height:1.25;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;line-clamp:3;overflow:hidden}
.news .ne{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;line-clamp:3;overflow:hidden}
.news .more{margin-top:auto;padding-top:4px;color:var(--act-ink,#6d28d9);font-weight:650;font-size:14px}
.cp .muted{color:var(--muted);font-size:14px}
.cp .body p{margin:0 0 16px;line-height:1.7}
.cp .l input,.cp .l textarea,.cp .l select{width:100%;min-height:52px;padding:12px 16px;border-radius:18px;border:1px solid var(--line);background:var(--soft);font:inherit;color:var(--ink)}
.cp .l textarea{min-height:120px}
.cp footer{max-width:1280px;margin:0 auto;padding:30px max(4vw,16px) 50px;display:flex;flex-wrap:wrap;gap:12px 22px;color:var(--muted);font-size:14px}
.cp footer a{text-decoration:none}
@media(max-width:760px){.cp .tbar nav a:not(.cta){display:none}}
</style>`;

export function chromePage(b: Bundle, seo: Seo, body: string, opts: { script?: string; status?: number } = {}): Response {
  const c = b.settings.contact;
  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Outfit:wght@300..700&family=Plus+Jakarta+Sans:wght@400..700&display=swap" rel="stylesheet">` +
    seoTags(seo, b.settings.seo?.site_name) + designCss() + EXTRA + `</head>`;
  const top = `<header class="top"><div class="tbar"><a class="logo brand" href="/"><img class="lg lg-c" src="/assets/b902c0e1d0b5e18b502f5249ee882e83.webp" alt="Inspire College" width="139" height="30"><img class="lg lg-w" src="/assets/dad81691bc200060ed05886b0e6b2ea9.webp" alt="" aria-hidden="true" width="139" height="30"></a>` +
    `<nav aria-label="Main"><a href="/programs">Programmes</a><a href="/news">News</a><a href="/contact">Contact</a><a href="/portal">Portal</a><a class="cta" href="/admissions">Apply now</a></nav></div></header>`;
  const foot = `<footer><span>© ${new Date().getFullYear()} Inspire College</span><a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy-policy">Privacy</a><a href="/refund-policy">Refunds</a><a href="/terms-conditions">Terms</a>` +
    `<a href="https://wa.me/${esc(c.whatsapp_main)}">WhatsApp ${esc(c.phone_display)}</a><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></footer>`;
  const html = `${head}<body><div class="ic cp">${top}<main class="wrap">${body}</main>${foot}</div>${opts.script ? `<script>${opts.script}</script>` : ""}</body></html>`;
  return htmlResponse(html, opts.status && opts.status >= 400 ? 0 : 60, opts.status || 200);
}

/** Site-styled "page not found" (real 404 status, not indexed). */
export function notFoundPage(b: Bundle, path: string): Response {
  return chromePage(
    b,
    { path, title: "Page not found | Inspire College", description: "This page could not be found.", noindex: true },
    `<div class="page" style="text-align:center;padding:40px 0 20px"><span class="eyebrow">Error 404</span><h1>We couldn't find that page.</h1>` +
      `<p class="lead">The link may be old or mistyped. Try one of these instead.</p>` +
      `<p style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:26px">` +
      `<a class="btn p" href="/">Go to the home page</a><a class="btn s" href="/programs">Browse programmes</a><a class="btn s" href="/contact">Contact us</a></p></div>`,
    { status: 404 },
  );
}

export { esc, safeJson };
