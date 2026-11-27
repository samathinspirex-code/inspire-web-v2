import { getBundle, getNewsItem } from "@/lib/backend";
import { chromePage, esc } from "@/lib/chrome";

export const revalidate = 300;

const NEWS_VIDEO_CSS = `<style>
.cp .nvid{position:relative;margin:18px 0;overflow:hidden;border:1px solid var(--line);border-radius:24px;background:#0d0718;box-shadow:var(--shadow)}
.cp .nvid video{display:block;width:100%;height:100%;object-fit:contain;background:#0d0718}
.cp .nvid-l{aspect-ratio:16/9}
.cp .nvid-p{aspect-ratio:9/16;margin:0 auto;width:min(100%,calc((100dvh - 140px) * 9 / 16))}
.cp .nvid-p video{object-fit:cover}
.cp .nvid-snd{position:absolute;left:14px;top:14px;display:inline-flex;gap:6px;align-items:center;padding:8px 14px;border:0;border-radius:999px;background:rgba(13,7,24,.78);color:#fff;font:600 13px/1 inherit;cursor:pointer}
.cp .nvid-err{display:grid;place-content:center;gap:10px;height:100%;min-height:220px;padding:24px;color:#fff;text-align:center}
.cp .nvid-err[hidden]{display:none}.cp .nvid-err a{color:#d9c2ff;font-weight:700}
.cp .nsplit-wrap{max-width:1140px}
.cp .nsplit{display:grid;grid-template-columns:minmax(260px,380px) minmax(0,1fr);gap:56px;align-items:start;margin-top:18px}
.cp .nsplit-media{position:sticky;top:110px}.cp .nsplit-media .nvid{margin:0}
.cp .nsplit-text{min-width:0}.cp .nsplit-text .body{max-width:720px}
@media(max-width:900px){.cp .nsplit{grid-template-columns:1fr;gap:24px}.cp .nsplit-media{position:static}.cp .nsplit .nvid-p{width:auto;height:min(70dvh,620px)}}
</style>`;

const NEWS_VIDEO_JS = `document.querySelectorAll('.nvid').forEach(function(f){var v=f.querySelector('video'),b=f.querySelector('.nvid-snd'),e=f.querySelector('.nvid-err');` +
  `v.muted=true;var p=v.play();if(p&&p.catch)p.catch(function(){});` +
  `b.addEventListener('click',function(){v.muted=false;v.play().catch(function(){});});` +
  `v.addEventListener('volumechange',function(){b.hidden=!v.muted;});` +
  `v.addEventListener('error',function(){v.remove();b.remove();e.hidden=false;});});`;

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const [b, n] = await Promise.all([getBundle(), getNewsItem(slug)]);
  if (!n) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  const paras = (n.body || "").split(/\n+/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join("");
  const portrait = !!n.video_url && n.video_orientation === "portrait";
  // Same as the current site: a portrait video is pinned beside the text while it scrolls; a landscape video sits
  // under the heading. It starts muted (browsers only autoplay muted) with a "Tap for sound" button.
  const poster = n.video_poster_url || (portrait ? "" : n.image);
  const video = n.video_url
    ? `<figure class="nvid nvid-${portrait ? "p" : "l"}"><video src="${esc(n.video_url)}"${poster ? ` poster="${esc(poster)}"` : ""} autoplay muted playsinline controls preload="metadata" aria-label="Video: ${esc(n.title)}"></video>` +
      `<button type="button" class="nvid-snd"><span aria-hidden="true">🔊</span> Tap for sound</button>` +
      `<div class="nvid-err" hidden><p>This video can't play here.</p><a href="${esc(n.video_url)}" target="_blank" rel="noopener noreferrer">Open video directly →</a></div></figure>`
    : "";
  const media = video || (n.image ? `<img src="${esc(n.image)}" alt="${esc(n.title)}" style="width:100%;border-radius:28px;margin:18px 0">` : "");
  const back = `<a href="/news" class="muted">← All news</a>`;
  const heading = `<span class="eyebrow" style="display:flex;margin-top:18px">${esc(n.category)}</span><h1>${esc(n.title)}</h1><p class="lead">${esc(n.excerpt)}</p>`;
  const article = portrait
    ? `<article class="page nsplit-wrap">${back}<div class="nsplit"><div class="nsplit-media">${video}</div><div class="nsplit-text">${heading}<div class="body">${paras}</div></div></div></article>`
    : `<article class="page">${back}${heading}${media}<div class="body">${paras}</div></article>`;
  return chromePage(
    b,
    {
      path: "/news/" + n.slug, title: `${n.title} | Inspire College`, description: n.excerpt, image: n.image,
      jsonLd: { "@context": "https://schema.org", "@type": "NewsArticle", headline: n.title, image: n.image ? [n.image] : undefined, datePublished: n.published_at },
    },
    NEWS_VIDEO_CSS + article,
    n.video_url ? { script: NEWS_VIDEO_JS } : {},
  );
}
