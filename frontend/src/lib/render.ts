// Serves the prepared design pages (src/site/pages) with CMS data, SEO tags and the site runtime.
import fs from "node:fs";
import path from "node:path";

import { SITE_URL, type Bundle } from "./backend";
import { buildIcData } from "./site-data";

const DIR = path.join(process.cwd(), "src", "site");
const cache = new Map<string, string>();
function read(rel: string): string {
  if (process.env.NODE_ENV === "production" && cache.has(rel)) return cache.get(rel)!;
  const s = fs.readFileSync(path.join(DIR, rel), "utf8");
  cache.set(rel, s);
  return s;
}

export const esc = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
// JSON that is safe inside <script>
const BS = String.fromCharCode(92); // backslash
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
export const safeJson = (v: unknown) =>
  JSON.stringify(v).split("<").join(BS + "u003c").split(LS).join(BS + "u2028").split(PS).join(BS + "u2029");

export type Seo = { title: string; description?: string; path: string; image?: string; jsonLd?: object; noindex?: boolean };

export function seoTags(seo: Seo, siteName = "Inspire College"): string {
  const url = SITE_URL + seo.path;
  const img = seo.image ? (seo.image.startsWith("http") ? seo.image : SITE_URL + seo.image) : SITE_URL + "/assets/b902c0e1d0b5e18b502f5249ee882e83.webp";
  return [
    `<title>${esc(seo.title)}</title>`,
    seo.description ? `<meta name="description" content="${esc(seo.description)}">` : "",
    `<link rel="canonical" href="${esc(url)}">`,
    seo.noindex ? `<meta name="robots" content="noindex">` : "",
    `<meta property="og:site_name" content="${esc(siteName)}"><meta property="og:type" content="website"><meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:title" content="${esc(seo.title)}">`,
    seo.description ? `<meta property="og:description" content="${esc(seo.description)}">` : "",
    `<meta property="og:image" content="${esc(img)}"><meta name="twitter:card" content="summary_large_image">`,
    `<meta name="theme-color" content="#6d28d9"><link rel="icon" href="/favicon.ico">`,
    seo.jsonLd ? `<script type="application/ld+json">${safeJson(seo.jsonLd)}</script>` : "",
  ].join("");
}

// Static design links ("Program.dc.html#p-hnd-se") become real URLs so crawlers and new tabs work.
export function routeFor(page: string, hash: string, slugs: Record<string, string>): string {
  const h = hash ? "#" + hash : "";
  switch (page) {
    case "Main": return hash === "features" ? "/brain" : "/" + h;
    case "Program": {
      const m = /^p-(.+)$/.exec(hash);
      if (m) return slugs[m[1]] ? "/programs/" + slugs[m[1]] : "/programs";
      return "/programs" + h;
    }
    case "Demo": return "/free-demo" + h;
    case "Aptitude": return "/aptitude" + h;
    case "Enrol": return "/admissions" + h;
    case "LMS": return "/portal";
    case "Live": return "/live-campus" + h;
    default: return "/";
  }
}

function siteBars(b: Bundle, page: string): { top: string; bottom: string } {
  const s = b.settings;
  let top = "", bottom = "";
  if (s.announcement_enabled && s.announcement_text) {
    const inner = esc(s.announcement_text) + (s.announcement_link ? ` <span style="text-decoration:underline">Learn more</span>` : "");
    const tag = s.announcement_link ? `a href="${esc(s.announcement_link)}"` : "div";
    top += `<${tag} id="ic-announce" style="display:block;position:relative;z-index:60;padding:9px 16px;text-align:center;font:600 13.5px/1.4 Geist,system-ui,sans-serif;color:#fff;background:linear-gradient(90deg,#2a0e5c,#6d28d9 60%,#a855f7);text-decoration:none">${inner}</${tag.split(" ")[0]}>`;
  }
  if (s.christmas_theme) {
    top += `<div aria-hidden="true" id="ic-snow"></div><style>#ic-snow{position:fixed;inset:0;pointer-events:none;z-index:250;background-image:radial-gradient(3px 3px at 20px 30px,#fff,transparent),radial-gradient(2px 2px at 120px 80px,#fff,transparent),radial-gradient(3px 3px at 220px 140px,#fff,transparent),radial-gradient(2px 2px at 300px 60px,#fff,transparent);background-size:340px 220px;opacity:.65;animation:icsnow 14s linear infinite}@keyframes icsnow{to{background-position:0 660px}}@media(prefers-reduced-motion:reduce){#ic-snow{display:none}}</style>`;
  }
  const pb = s.promo_banner;
  if (page === "Main" && pb && pb.enabled && (pb.title || pb.text)) {
    bottom = `<aside id="ic-promo" style="position:fixed;left:16px;right:16px;bottom:88px;z-index:70;max-width:520px;margin:0 auto;display:flex;gap:14px;align-items:center;padding:14px 16px;border-radius:24px;background:#160f24;color:#fff;font:15px/1.45 Geist,system-ui,sans-serif;box-shadow:0 24px 60px -24px rgba(42,14,92,.6)">` +
      (pb.image ? `<img src="${esc(pb.image)}" alt="" style="width:64px;height:64px;border-radius:16px;object-fit:cover;flex:none">` : "") +
      `<div style="flex:1;min-width:0"><b style="display:block">${esc(pb.title)}</b><span style="opacity:.8">${esc(pb.text)}</span></div>` +
      (pb.link ? `<a href="${esc(pb.link)}" style="flex:none;padding:10px 16px;border-radius:999px;background:#fff;color:#160f24;font-weight:600;text-decoration:none">${esc(pb.cta || "Open")}</a>` : "") +
      `<button type="button" aria-label="Close" onclick="this.parentNode.remove()" style="flex:none;width:32px;height:32px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;cursor:pointer">×</button></aside>`;
  }
  return { top, bottom };
}

export type RenderOpts = { seo: Seo; hash?: string; data?: Record<string, unknown> };

// Course banners from the current site are 1450x750 (29:15) with text printed on them.
// Boxes that show them take that shape, so "cover" fills the box without cutting anything off.
const B = (sel: string) => `${sel}[style*="cloudfront.net"]`;
const BANNER_FIT =
  "<style>" +
  // Only real course banners (served from the current site's CDN) are reshaped; the design's own photos keep their framing.
  `.pc-img,${B(".fimg")},${B(".pg-img")},${B(".pg-rc .pg-ri")},${B(".sum .img")}{aspect-ratio:29/15!important;background-size:cover!important;background-position:center!important;background-repeat:no-repeat}` +
  // Small square/round thumbnails (enrol drawer list, add-ons, chosen programme, "Continue" pills) become small banner-shaped tiles.
  `${B(".xprog .xpi")},${B(".xli i")},${B(".xadd i")},${B(".xfc i")},${B(".resume i")},${B(".dk-res i")}{background-size:cover!important;background-position:center!important;background-repeat:no-repeat;flex:none}` +
  `${B(".xprog .xpi")}{width:96px!important;height:50px!important;border-radius:12px!important}` +
  `${B(".xli i")}{width:72px!important;height:37px!important;border-radius:10px!important}` +
  `${B(".xadd i")}{width:68px!important;height:35px!important;border-radius:10px!important}` +
  `${B(".xfc i")}{width:58px!important;height:30px!important;border-radius:8px!important}` +
  `${B(".resume i")}{width:46px!important;height:24px!important;border-radius:7px!important}` +
  `${B(".dk-res i")}{width:38px!important;height:20px!important;border-radius:6px!important}` +
  // The banner is shorter than the design's 4:5 photo, so pin it level with the heading (below the kicker line) instead of the bottom.
  "@media(min-width:861px){.pg-hero{align-items:start!important}.pg-fig{margin-top:39px!important}}" +
  // Banners carry their heading top-left and the awarding-body logo bottom-left, so card badges sit on the right.
  ".pc-rec,.pc-bon,.ic .pc-rec{left:auto!important;right:10px!important}" +
  `${B(".fimg")} .fbadge{left:auto!important;right:14px!important}` +
  // CPU: no live blur over moving video (labels get a near-identical solid pill), lighter blur elsewhere,
  // and off-screen sections are not rendered until scrolled near.
  ".tile .lbl,.tile .live{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}" +
  ".tile .lbl{background:rgba(255,255,255,.95)!important}.tile .live{background:rgba(20,8,40,.68)!important}" +
  ".hbar{-webkit-backdrop-filter:saturate(1.5) blur(12px)!important;backdrop-filter:saturate(1.5) blur(12px)!important}" +
  ".sk-card,.sk-count{-webkit-backdrop-filter:blur(8px)!important;backdrop-filter:blur(8px)!important}" +
  "section.band{content-visibility:auto;contain-intrinsic-size:auto 900px}" +
  // Student stories: inline video fills the expanded card (transparent until its first frame, so the photo shows meanwhile).
  // Videos are portrait 9:16 with a branded strip at the top: keep them centred (crops top and bottom evenly).
  ".st-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center center;opacity:0;transition:opacity .5s;pointer-events:none}.st.on .st-vid{opacity:1}" +
  // Visionary leaders: separate cards, photo in a fixed 4:5 frame, name, role and a short description.
  ".leaders{align-items:stretch}" +
  ".ldr{display:flex;flex-direction:column;border-radius:30px;overflow:hidden;background:var(--card,#fff);border:1px solid var(--line,#eee);transition:transform .5s cubic-bezier(.2,.8,.2,1),box-shadow .3s}" +
  ".ldr:hover{transform:translateY(-4px);box-shadow:var(--shadow)}" +
  ".ldr-ph{position:relative;aspect-ratio:4/5;margin:8px 8px 0;border-radius:24px;overflow:hidden;background:var(--soft,#f1ecfb);display:grid;place-items:center}" +
  ".ldr-ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}" +
  ".ldr-ph .av{width:84px;height:84px;font-size:26px}" +
  ".ldr-b{display:block;padding:14px 16px 18px}" +
  ".ldr-b b{display:block;font-weight:650;font-size:16.5px;line-height:1.25;letter-spacing:-.01em}" +
  ".ldr-b small{display:block;color:var(--act-ink,#6d28d9);font-size:13px;font-weight:600;margin-top:3px}" +
  ".ldr-b p{margin:10px 0 0;color:var(--muted);font-size:13.5px;line-height:1.5}" +
  "@media(max-width:560px){.ic .leaders .ldr{flex:0 0 72%;scroll-snap-align:start}}" +
  // Phones: the design's 104px side thumbnail is too small for a text banner, so show it full width on top.
  "@media(max-width:560px){.ic .pc{grid-template-columns:minmax(0,1fr)!important}" +
  ".ic .pc-img{grid-row:auto!important;min-height:0!important;height:auto!important;margin:8px 8px 0!important}}" +
  "</style>";

// Home "Latest from Inspire College": the design's three placeholder tiles become the latest real news (CMS / current site),
// each showing its own banner in full.
function newsCards(b: Bundle): string {
  const items = (b.news || []).slice(0, 12);
  if (!items.length) return '<div class="news"></div>';
  const cards = items.map((n) => {
    const d = n.published_at ? new Date(n.published_at) : null;
    const date = d && !isNaN(+d) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Colombo" }) : "";
    const meta = [date, n.category].filter(Boolean).join(" · ");
    const pic = n.image
      ? `<span class="nv nv-img" aria-hidden="true" style="background-image:url('${esc(n.image)}')"></span>`
      : `<span class="nv nv-a" aria-hidden="true"><em>News</em><i>${esc(n.category || "College news")}</i></span>`;
    return `<a class="nc" href="/news/${encodeURIComponent(n.slug)}">${pic}<span class="nb"><small>${esc(meta)}</small><h3>${esc(n.title)}</h3><p>${esc(n.excerpt || "")}</p><span class="more">Read more →</span></span></a>`;
  });
  // A sliding row: 3 cards on desktop, 2 on tablets, swipe on phones, with ‹ › arrows on the sides.
  const css =
    "<style>.nv-img{background-size:contain;background-position:center;background-repeat:no-repeat;background-color:var(--soft,#f1ecfb);aspect-ratio:16/9!important}" +
    ".nx-wrap{position:relative;margin-top:36px}" +
    ".news.nx{display:flex!important;gap:16px;margin-top:0!important;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:none;padding:4px 2px 10px}" +
    ".news.nx::-webkit-scrollbar{display:none}.news.nx>*{animation:none!important}" +
    ".news.nx>.nc{flex:0 0 calc((100% - 32px)/3);scroll-snap-align:start}" +
    ".nx-btn{position:absolute;top:calc(50% - 26px);z-index:3;width:52px;height:52px;border-radius:50%;border:1px solid rgba(124,58,237,.18);background:#fff;color:#5b21b6;" +
    "font-size:22px;line-height:1;display:grid;place-items:center;cursor:pointer;box-shadow:0 10px 26px rgba(76,29,149,.18);transition:opacity .2s,transform .2s}" +
    ".nx-btn:hover{transform:scale(1.06)}.nx-prev{left:-26px}.nx-next{right:-26px}" +
    "@media(max-width:1100px){.nx-prev{left:-8px}.nx-next{right:-8px}}" +
    "@media(max-width:900px){.news.nx>.nc{flex-basis:calc((100% - 16px)/2)}}" +
    "@media(max-width:760px){.news.nx{gap:12px;margin-left:-20px!important;margin-right:-20px!important;padding:4px 20px 10px;scroll-padding:0 20px}.news.nx>.nc{flex-basis:min(82%,320px)}" +
    ".nx-btn{width:42px;height:42px;font-size:18px;top:clamp(60px,calc(41vw*9/16 - 7px),110px)}.nx-prev{left:-6px}.nx-next{right:-6px}}</style>";
  // Both arrows always show and wrap around at the ends (the page framework resets attributes, so no enabled/disabled state).
  const js =
    "<script>(function(){document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.nx-btn');if(!b)return;e.preventDefault();" +
    "var s=b.closest('.nx-wrap').querySelector('.news'),c=s.querySelector('.nc'),next=b.classList.contains('nx-next');" +
    "var step=c?c.getBoundingClientRect().width+parseFloat(getComputedStyle(s).columnGap||16):s.clientWidth,max=s.scrollWidth-s.clientWidth;" +
    "if(next&&s.scrollLeft>=max-4)s.scrollTo({left:0,behavior:'smooth'});else if(!next&&s.scrollLeft<4)s.scrollTo({left:max,behavior:'smooth'});" +
    "else s.scrollBy({left:(next?1:-1)*step,behavior:'smooth'});},true);})();</script>";
  return `${css}<div class="nx-wrap"><button type="button" class="nx-btn nx-prev" aria-label="Previous news">‹</button><div class="news nx">${cards.join("")}</div><button type="button" class="nx-btn nx-next" aria-label="More news">›</button></div>${js}`;
}

export function renderDesignPage(page: string, b: Bundle, opts: RenderOpts): Response {
  const data = buildIcData(b, { page, ...(opts.data || {}) });
  let html = read(`pages/${page}.html`);
  const c = b.settings.contact;
  html = html
    .replace(/href="([A-Za-z]+)\.dc\.html(?:#([^"{]*))?"/g, (_m, p, h) => `href="${routeFor(p, h || "", data.slugs)}"`)
    .replace(/__IC_WA_MAIN__|94711993331/g, c.whatsapp_main)
    .replace(/__IC_WA_ADVISOR__|94743762393/g, c.whatsapp_advisor)
    .replace(/<title>[^<]*<\/title>/, "");
  const head =
    seoTags(opts.seo, b.settings.seo?.site_name) +
    BANNER_FIT +
    `<script>window.IC_DATA=${safeJson(data)};${opts.hash ? `window.__dcHash=${safeJson(opts.hash)};` : ""}</script>` +
    `<script>${read("tracking.js")}</script><script>${read("runtime.js")}</script>`;
  html = html.replace("<!--IC_HEAD-->", head);
  if (page === "Main") html = html.replace(/<div class="news">[\s\S]*?\n  <\/div>/, newsCards(b));
  const bars = siteBars(b, page);
  if (bars.top) html = html.replace("<body>", "<body>" + bars.top);
  if (bars.bottom) html = html.replace("</body>", bars.bottom + "</body>");
  return htmlResponse(html, 60);
}

export function renderPortalPage(opts: { demo: Record<string, unknown>; name: string; seo: Seo }): Response {
  const clean = (s: string) => s.replace(/[^A-Za-zÀ-ɏ .\-]/g, "").trim() || "Student";
  const full = clean(opts.name);
  let html = read("pages/Portal.html").replace(/__IC_FULL__/g, full).replace(/__IC_FIRST__/g, full.split(" ")[0]);
  html = html.replace("<!--IC_HEAD-->", seoTags({ ...opts.seo, noindex: true }) + `<script>window.__DEMO=${safeJson(opts.demo)};</script><script>${read("portal.js")}</script>`);
  html = html.replace(/<title>Inspire Brain · Demo<\/title>/, "");
  return htmlResponse(html, 0);
}

export function htmlResponse(html: string, sMaxAge: number, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": sMaxAge ? `public, s-maxage=${sMaxAge}, stale-while-revalidate=600` : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

// Shown when the API is still waking up (free hosting sleeps when idle). Keeps the login cookie and retries by itself.
export function wakingPage(): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Opening Inspire Brain…</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#120a24;color:#fff;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:20px}
.s{width:42px;height:42px;border-radius:50%;border:4px solid rgba(255,255,255,.2);border-top-color:#c6f432;margin:0 auto 18px;animation:r 1s linear infinite}@keyframes r{to{transform:rotate(360deg)}}
p{color:rgba(255,255,255,.7);margin:6px 0}</style></head><body><div><div class="s"></div><h1 style="font-size:22px;margin:0">Opening your Inspire Brain demo…</h1>
<p>The demo server is waking up. This can take up to a minute.</p><p id="t"></p></div>
<script>var n=0;function go(){n++;document.getElementById('t').textContent='Trying again… ('+n+')';location.reload();}setTimeout(go,6000);</script></body></html>`;
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "6" } });
}
