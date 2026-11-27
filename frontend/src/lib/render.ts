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

export type Seo = { title: string; description?: string; path: string; image?: string; jsonLd?: object | object[]; noindex?: boolean };

const MEDIA_CDN = "https://d18ep2e197efjz.cloudfront.net";

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
    `<meta property="og:locale" content="en_LK"><meta property="og:image" content="${esc(img)}"><meta property="og:image:alt" content="${esc(seo.title)}">`,
    `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(seo.title)}">`,
    seo.description ? `<meta name="twitter:description" content="${esc(seo.description)}">` : "",
    `<meta name="theme-color" content="#6d28d9"><link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/apple-icon.png">`,
    // Fonts and CMS images come from other hosts: open those connections early.
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="preconnect" href="${MEDIA_CDN}">`,
    ...(seo.jsonLd ? ([] as object[]).concat(seo.jsonLd).map((j) => `<script type="application/ld+json">${safeJson(j)}</script>`) : []),
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

// Closable bars: a short id of the content, so editing the message in the CMS shows it again.
function dismissId(text: string): string {
  let x = 5381;
  for (let i = 0; i < text.length; i++) x = ((x * 33) ^ text.charCodeAt(i)) >>> 0;
  return x.toString(36);
}

// Runs right after the bar, before it paints: hides it if this visitor already closed it, wires the × and,
// for the top strip, tells the sticky header how far down to sit.
function dismissScript(elId: string, id: string, pushHeader: boolean): string {
  const k = JSON.stringify("icClosed:" + elId);
  return `<script>(function(){var el=document.getElementById(${JSON.stringify(elId)});if(!el)return;var k=${k},v=${JSON.stringify(id)},r=document.documentElement;` +
    `function gone(){el.remove();${pushHeader ? "r.style.removeProperty('--ic-ann-h');" : ""}}` +
    `try{if(localStorage.getItem(k)===v){gone();return;}}catch(e){}` +
    (pushHeader ? `function fit(){if(el.isConnected)r.style.setProperty('--ic-ann-h',el.offsetHeight+'px');}fit();addEventListener('resize',fit);` : "") +
    `el.querySelector('[data-ic-close]').addEventListener('click',function(e){e.preventDefault();e.stopPropagation();try{localStorage.setItem(k,v);}catch(x){}gone();});})();</script>`;
}

function siteBars(b: Bundle, page: string): { top: string; bottom: string } {
  const s = b.settings;
  let top = "", bottom = "";
  if (s.announcement_enabled && s.announcement_text) {
    // Stays at the top while scrolling (the sticky header sits just below it). Closing it is remembered in this
    // browser for this message only, so a new announcement shows again.
    const id = dismissId(s.announcement_text + "|" + (s.announcement_link || ""));
    const inner = esc(s.announcement_text) + (s.announcement_link ? ` <span style="text-decoration:underline">Learn more</span>` : "");
    const tag = s.announcement_link ? `a href="${esc(s.announcement_link)}"` : "span";
    // The message glides right to left across the strip (same motion as the current site), pausing on hover.
    top += `<div id="ic-announce" role="region" aria-label="Announcement">` +
      `<${tag} class="ica-link" aria-label="${esc(s.announcement_text)}"><span class="ica-track" aria-hidden="true"><span class="ica-text">${inner}</span></span></${tag.split(" ")[0]}>` +
      `<button type="button" aria-label="Close announcement" data-ic-close="ic-announce">×</button></div>` +
      `<style>#ic-announce{position:sticky;top:0;z-index:65;display:flex;align-items:center;gap:8px;height:40px;padding:0 8px;color:#fff;background:linear-gradient(90deg,#2a0e5c,#6d28d9 60%,#a855f7);font:600 14px/1 Geist,system-ui,sans-serif}` +
      `#ic-announce .ica-link{position:relative;flex:1;align-self:stretch;min-width:0;color:#fff;text-decoration:none}` +
      `#ic-announce .ica-track{position:absolute;inset:0 6% 0 4%;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)}` +
      `#ic-announce .ica-text{position:absolute;top:50%;left:100%;white-space:nowrap;letter-spacing:.01em;transform:translate(0,-50%);animation:ica-glide 18s linear infinite}` +
      `#ic-announce:hover .ica-text{animation-play-state:paused}` +
      `@keyframes ica-glide{0%{left:100%;transform:translate(0,-50%);opacity:0}8%{opacity:1}86%{opacity:1}100%{left:0;transform:translate(-100%,-50%);opacity:0}}` +
      `#ic-announce [data-ic-close]{flex:none;width:28px;height:28px;border-radius:50%;border:0;background:rgba(255,255,255,.16);color:#fff;font-size:17px;line-height:1;cursor:pointer}` +
      `@media(max-width:560px){#ic-announce{height:36px;font-size:12.5px}#ic-announce .ica-track{inset:0 2px}#ic-announce .ica-text{animation-duration:14s}}` +
      `@media(prefers-reduced-motion:reduce){#ic-announce .ica-text{animation:none;left:50%;transform:translate(-50%,-50%);max-width:100%;overflow:hidden;text-overflow:ellipsis}}` +
      `.hdr{top:calc(12px + var(--ic-ann-h,0px))!important}</style>` +
      dismissScript("ic-announce", id, true);
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
      `<button type="button" aria-label="Close" data-ic-close="ic-promo" style="flex:none;width:32px;height:32px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;cursor:pointer">×</button></aside>` +
      dismissScript("ic-promo", dismissId([pb.title, pb.text, pb.link, pb.image].join("|")), false);
  }
  if (page === "Main") {
    bottom += `<a class="wa-float" href="${WA_BOT}" target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp" title="Chat with us on WhatsApp">` +
      `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path fill="currentColor" d="${WA_ICON}"/></svg></a>`;
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
  // "Ask Inspire AI" floating button: just the round icon, opening to show the label while the pointer is on it.
  // No dark ring: the coloured circle is the whole button; the dark pill only appears with the label on hover.
  ".ic .ai-fab{padding:0;gap:0;min-height:56px;background:transparent;box-shadow:none;transition:background .3s,box-shadow .3s;animation:icfab-in .7s cubic-bezier(.34,1.56,.64,1) .6s backwards}" +
  ".ic .ai-fab i{position:relative;width:56px;height:56px;box-shadow:0 14px 30px -10px color-mix(in srgb,var(--act,#6d28d9) 70%,transparent)}" +
  ".ic .ai-fab i::after{content:'';position:absolute;inset:0;border-radius:50%;border:2px solid var(--act,#6d28d9);opacity:0;animation:icfab-ring 3.2s cubic-bezier(.22,.61,.36,1) 1.6s infinite}" +
  ".ic .ai-fab i svg{width:22px;height:22px;animation:icfab-spark 3.2s ease-in-out 1.6s infinite}" +
  ".ic .ai-fab:hover{background:var(--ink);box-shadow:0 20px 40px -16px rgba(42,14,92,.6)}" +
  "@keyframes icfab-in{0%{opacity:0;transform:scale(0) rotate(-90deg)}100%{opacity:1;transform:none}}" +
  "@keyframes icfab-ring{0%{opacity:.6;transform:scale(1)}80%,100%{opacity:0;transform:scale(1.6)}}" +
  "@keyframes icfab-spark{0%,70%,100%{transform:scale(1) rotate(0)}78%{transform:scale(1.25) rotate(25deg)}86%{transform:scale(.9) rotate(-10deg)}}" +
  // Home: WhatsApp button above the AI button (same look and motion as the current site).
  ".wa-float{position:fixed;right:22px;bottom:92px;z-index:70;display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:#25D366;color:#fff;text-decoration:none;" +
  "box-shadow:0 8px 22px rgba(18,140,74,.38),0 2px 6px rgba(0,0,0,.12);transition:transform .3s cubic-bezier(.34,1.56,.64,1),background-color .3s;animation:icfab-in .7s cubic-bezier(.34,1.56,.64,1) .8s backwards}" +
  ".wa-float::before,.wa-float::after{content:'';position:absolute;inset:0;z-index:-1;border:2px solid #25D366;border-radius:50%;opacity:0;animation:icwa-ripple 3s cubic-bezier(.22,.61,.36,1) 1.5s infinite}" +
  ".wa-float::after{animation-delay:2.5s}" +
  ".wa-float svg{width:28px;height:28px;transform-origin:50% 60%;animation:icwa-wiggle 4s ease-in-out 2s infinite}" +
  ".wa-float:hover{background:#1EBE5A;transform:scale(1.1)}.wa-float:hover svg{animation:none;transform:rotate(-12deg)}.wa-float:active{transform:scale(.94)}" +
  "@keyframes icwa-ripple{0%{opacity:.7;transform:scale(1)}80%,100%{opacity:0;transform:scale(1.7)}}" +
  "@keyframes icwa-wiggle{0%,80%,100%{transform:rotate(0)}84%{transform:rotate(-14deg)}88%{transform:rotate(12deg)}92%{transform:rotate(-8deg)}96%{transform:rotate(4deg)}}" +
  // Phones: the AI button is hidden and the Apply bar + tab bar sit at the bottom, so WhatsApp goes above them.
  "@media(max-width:760px){.wa-float{right:16px;bottom:calc(152px + env(safe-area-inset-bottom));width:48px;height:48px}.wa-float svg{width:26px;height:26px}}" +
  // Phones: the hero offer pill wraps instead of being cut off; the demo header drops the "Free demo class"
  // subtitle so the level label beside the L1 badge has room.
  "@media(max-width:760px){.ic .camp{border-radius:22px;max-width:100%}.ic .camp span{white-space:normal;overflow:visible;text-overflow:clip;line-height:1.3}}" +
  "@media(max-width:560px){.ic .tbar .logo.brand>span.lgsub{display:none!important}}" +
  // Phones: bigger tap areas (44px) for small links, without moving the layout (padding offset by negative margin).
  "@media(max-width:760px){.ic footer .fcols a{display:flex;align-items:center;min-height:44px}" +
  ".ic footer .base a,.ic footer .base button,.ic footer .fs a,.ic .fnote a,.ic .pc-more,.ic .pc-note button,.ic .pc-t a,.ic .verify{display:inline-block;padding-block:13px;margin-block:-13px}" +
  "#ic-announce [data-ic-close]{width:36px!important;height:36px!important}}" +
  "@media(prefers-reduced-motion:reduce){.ic .ai-fab,.ic .ai-fab i::after,.ic .ai-fab i svg,.wa-float,.wa-float::before,.wa-float::after,.wa-float svg{animation:none!important}}" +
  ".ic .ai-fab>span{max-width:0;margin:0;opacity:0;overflow:hidden;white-space:nowrap;transition:max-width .35s ease,margin .35s ease,opacity .25s ease}" +
  ".ic .ai-fab:hover>span,.ic .ai-fab:focus-visible>span{max-width:160px;margin:0 14px 0 10px;opacity:1}" +
  "</style>";

const WA_ICON =
  "M16.04 3C8.86 3 3.03 8.82 3.03 16c0 2.3.6 4.54 1.74 6.52L3 29l6.65-1.74A12.96 12.96 0 0 0 16.04 29C23.2 29 29 23.18 29 16S23.2 3 16.04 3Zm0 23.8c-1.95 0-3.86-.52-5.53-1.51l-.4-.24-3.94 1.03 1.05-3.84-.26-.4A10.77 10.77 0 0 1 5.2 16c0-5.97 4.86-10.83 10.84-10.83 5.96 0 10.8 4.86 10.8 10.83 0 5.98-4.84 10.8-10.8 10.8Zm5.93-8.1c-.33-.16-1.93-.95-2.23-1.06-.3-.11-.52-.16-.73.16-.22.33-.84 1.06-1.03 1.28-.19.22-.38.24-.7.08-.33-.16-1.38-.51-2.62-1.62-.97-.86-1.62-1.93-1.81-2.25-.19-.33-.02-.5.14-.66.15-.15.33-.38.49-.57.16-.19.22-.33.33-.54.11-.22.05-.41-.03-.57-.08-.16-.73-1.76-1-2.41-.26-.63-.53-.55-.73-.56h-.62c-.22 0-.57.08-.87.41-.3.33-1.14 1.11-1.14 2.71s1.17 3.14 1.33 3.36c.16.22 2.3 3.5 5.56 4.91.78.34 1.39.54 1.86.69.78.25 1.49.21 2.05.13.63-.09 1.93-.79 2.2-1.55.27-.76.27-1.41.19-1.55-.08-.14-.3-.22-.62-.38Z";

// "Chat on WhatsApp" links open the WhatsApp bot with a ready-typed greeting.
const WA_BOT =
  "https://api.whatsapp.com/send/?phone=94743762393&amp;text=Hi+Inspire+College%21+I%27d+like+to+know+more+about+your+programmes.&amp;type=phone_number&amp;app_absent=0";

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
    ".nx-wrap .nb{display:flex!important;flex-direction:column;flex:1}.nx-wrap .nc h3{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;line-clamp:3;overflow:hidden}" +
    ".nx-wrap .nc p{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;line-clamp:3;overflow:hidden}.nx-wrap .nc .more{margin-top:auto;padding-top:14px}" +
    ".news.nx{display:flex!important;gap:16px;margin-top:0!important;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:none;padding:4px 2px 10px}" +
    ".news.nx::-webkit-scrollbar{display:none}.news.nx>*{animation:none!important}" +
    ".news.nx>.nc{flex:0 0 calc((100% - 32px)/3);scroll-snap-align:start}" +
    ".nx-btn{position:absolute;top:calc(50% - 26px);z-index:3;width:52px;height:52px;border-radius:50%;border:1px solid rgba(124,58,237,.18);background:#fff;color:#5b21b6;" +
    "font-size:22px;line-height:1;display:grid;place-items:center;cursor:pointer;box-shadow:0 10px 26px rgba(76,29,149,.18);transition:opacity .2s,transform .2s}" +
    ".nx-btn:hover{transform:scale(1.06)}.nx-prev{opacity:0;pointer-events:none}.nx-prev{left:-26px}.nx-next{right:-26px}" +
    "@media(max-width:1100px){.nx-prev{left:-8px}.nx-next{right:-8px}}" +
    "@media(max-width:900px){.news.nx>.nc{flex-basis:calc((100% - 16px)/2)}}" +
    "@media(max-width:760px){.news.nx{gap:12px;margin-left:-20px!important;margin-right:-20px!important;padding:4px 20px 10px;scroll-padding:0 20px}.news.nx>.nc{flex-basis:min(82%,320px)}" +
    ".nx-btn{width:42px;height:42px;font-size:18px;top:clamp(60px,calc(41vw*9/16 - 7px),110px)}.nx-prev{left:-6px}.nx-next{right:-6px}}</style>";
  // Arrows hide at the ends. The page framework resets attributes on its own nodes, so the state lives in a
  // <style id="nx-state"> this script owns in <head> (prev is hidden by default until the row is scrolled).
  const js =
    "<script>(function(){function st(){var s=document.querySelector('.nx-wrap .news');if(!s)return;" +
    "var el=document.getElementById('nx-state');if(!el){el=document.createElement('style');el.id='nx-state';document.head.appendChild(el);}" +
    "var h='{opacity:0;pointer-events:none}',v='{opacity:1;pointer-events:auto}',atS=s.scrollLeft<4,atE=s.scrollLeft+s.clientWidth>=s.scrollWidth-4;" +
    "var css='.nx-wrap .nx-btn.nx-prev'+(atS?h:v)+'.nx-wrap .nx-btn.nx-next'+(atE?h:v);if(el.textContent!==css)el.textContent=css;}" +
    "document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.nx-btn');if(!b)return;e.preventDefault();" +
    "var s=b.closest('.nx-wrap').querySelector('.news'),c=s.querySelector('.nc');" +
    "var step=c?c.getBoundingClientRect().width+parseFloat(getComputedStyle(s).columnGap||16):s.clientWidth;" +
    "s.scrollBy({left:(b.classList.contains('nx-next')?1:-1)*step,behavior:'smooth'});},true);" +
    "document.addEventListener('scroll',function(e){var t=e.target;if(t&&t.classList&&t.classList.contains('nx'))st();},true);" +
    "window.addEventListener('resize',st);window.addEventListener('load',st);setTimeout(st,300);setTimeout(st,1500);})();</script>";
  return `${css}<div class="nx-wrap"><button type="button" class="nx-btn nx-prev" aria-label="Previous news">‹</button><div class="news nx">${cards.join("")}</div><button type="button" class="nx-btn nx-next" aria-label="More news">›</button></div>${js}`;
}

export function renderDesignPage(page: string, b: Bundle, opts: RenderOpts): Response {
  const data = buildIcData(b, { page, ...(page === "Program" ? { detailKey: "hnd-se" } : {}), ...(opts.data || {}) });
  let html = read(`pages/${page}.html`);
  const c = b.settings.contact;
  html = html
    .replace(/href="([A-Za-z]+)\.dc\.html(?:#([^"{]*))?"/g, (_m, p, h) => `href="${routeFor(p, h || "", data.slugs)}"`)
    .replace(/__IC_WA_MAIN__|94711993331/g, c.whatsapp_main)
    .replace(/__IC_WA_ADVISOR__|94743762393/g, c.whatsapp_advisor)
    .replace(/__IC_PHONE__/g, esc(c.phone_display))
    .replace(/__IC_WA_BOT__/g, WA_BOT) // after the number swaps, so the bot's number is left as it is
    .replace(/<title>[^<]*<\/title>/, "");
  const head =
    seoTags(opts.seo, b.settings.seo?.site_name) +
    BANNER_FIT +
    `<script>window.IC_DATA=${safeJson(data)};${opts.hash ? `window.__dcHash=${safeJson(opts.hash)};` : ""}</script>` +
    `<script>${read("tracking.js")}</script><script>${read("runtime.js")}</script>`;
  html = html.replace("<!--IC_HEAD-->", head);
  // Home stats: the programme count comes from the live course list.
  if (page === "Main" && b.courses.length) html = html.replace('<div><b>87</b><span>programmes', `<div><b>${b.courses.length}</b><span>programmes`);
  if (page === "Main") html = html.replace(/<div class="news">[\s\S]*?\n  <\/div>/, newsCards(b));
  const bars = siteBars(b, page);
  // The real <body> tag comes after </head> (inlined scripts could mention the word earlier).
  if (bars.top) html = html.replace(/(<\/head>\s*<body[^>]*>)/, "$1" + bars.top.replace(/\$/g, "$$$$"));
  if (bars.bottom) { const i = html.lastIndexOf("</body>"); if (i >= 0) html = html.slice(0, i) + bars.bottom + html.slice(i); }
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
