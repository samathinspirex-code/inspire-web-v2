import { getBundle, getNewsList } from "@/lib/backend";
import { chromePage, esc } from "@/lib/chrome";

export const revalidate = 300;

const date = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export async function GET() {
  const [b, news] = await Promise.all([getBundle(), getNewsList()]);
  const cards = news
    .map((n) => `<article class="card news"><a href="/news/${esc(n.slug)}">${n.image ? `<img src="${esc(n.image)}" alt="" loading="lazy">` : ""}<span class="muted">${esc(n.category)}${n.published_at ? " · " + date(n.published_at) : ""}</span><b class="nt">${esc(n.title)}</b><span class="muted ne">${esc(n.excerpt)}</span><span class="more">Read more →</span></a></article>`)
    .join("");
  return chromePage(
    b,
    { path: "/news", title: "News & events | Inspire College", description: "News, events and stories from Inspire College." },
    `<span class="eyebrow">News &amp; events</span><h1>What's new at Inspire.</h1><div class="grid" style="margin-top:24px">${cards || "<p>No news yet.</p>"}</div>`,
  );
}
