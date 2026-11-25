import { getBundle } from "@/lib/backend";
import { renderDesignPage } from "@/lib/render";
import { courseBySlug } from "@/lib/site-data";

export const revalidate = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const b = await getBundle();
  const c = courseBySlug(b, slug);
  if (!c) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  return renderDesignPage("Program", b, {
    hash: "p-" + c.key,
    data: { boot: { campaign: b.settings.default_campaign || "scholarship", programme: c.key } },
    seo: {
      path: "/programs/" + c.slug,
      title: `${c.seo_title || c.title} | Inspire College`,
      description: c.seo_description || c.blurb,
      image: c.image,
      jsonLd: {
        "@context": "https://schema.org", "@type": "Course", name: c.title, description: c.seo_description || c.blurb,
        provider: { "@type": "CollegeOrUniversity", name: "Inspire College" },
        ...(c.fee ? { offers: { "@type": "Offer", price: c.fee, priceCurrency: "LKR", category: "Paid" } } : {}),
      },
    },
  });
}
