import { getBundle, getNewsItem } from "@/lib/backend";
import { chromePage, esc } from "@/lib/chrome";

export const revalidate = 300;

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const [b, n] = await Promise.all([getBundle(), getNewsItem(slug)]);
  if (!n) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  const paras = (n.body || "").split(/\n+/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join("");
  const media = n.video_url
    ? `<video src="${esc(n.video_url)}" controls playsinline style="width:100%;border-radius:28px;margin:18px 0"></video>`
    : n.image ? `<img src="${esc(n.image)}" alt="" style="width:100%;border-radius:28px;margin:18px 0">` : "";
  return chromePage(
    b,
    {
      path: "/news/" + n.slug, title: `${n.title} | Inspire College`, description: n.excerpt, image: n.image,
      jsonLd: { "@context": "https://schema.org", "@type": "NewsArticle", headline: n.title, image: n.image ? [n.image] : undefined, datePublished: n.published_at },
    },
    `<article class="page"><a href="/news" class="muted">← All news</a><span class="eyebrow" style="display:flex;margin-top:18px">${esc(n.category)}</span><h1>${esc(n.title)}</h1><p class="lead">${esc(n.excerpt)}</p>${media}<div class="body">${paras}</div></article>`,
  );
}
