import { getBundle, SITE_URL } from "@/lib/backend";
import { notFoundPage } from "@/lib/chrome";
import { renderDesignPage } from "@/lib/render";
import { courseBySlug } from "@/lib/site-data";

export const revalidate = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const b = await getBundle();
  const c = courseBySlug(b, slug);
  if (!c) return notFoundPage(b, "/programs/" + slug);
  return renderDesignPage("Program", b, {
    hash: "p-" + c.key,
    data: { detailKey: c.key, boot: { campaign: b.settings.default_campaign || "scholarship", programme: c.key } },
    seo: {
      path: "/programs/" + c.slug,
      title: `${c.seo_title || c.title} | Inspire College`,
      description: c.seo_description || c.blurb,
      image: c.image,
      jsonLd: [
        {
          "@context": "https://schema.org", "@type": "Course", name: c.title, description: c.seo_description || c.blurb, url: SITE_URL + "/programs/" + c.slug,
          ...(c.image ? { image: c.image.startsWith("http") ? c.image : SITE_URL + c.image } : {}),
          inLanguage: "en",
          provider: { "@type": "CollegeOrUniversity", name: "Inspire College", url: SITE_URL + "/" },
          ...(c.body ? { educationalCredentialAwarded: c.body } : {}),
          hasCourseInstance: { "@type": "CourseInstance", courseMode: "Online" },
          ...(c.fee ? { offers: { "@type": "Offer", price: c.fee, priceCurrency: "LKR", category: "Paid", url: SITE_URL + "/programs/" + c.slug } } : {}),
        },
        {
          "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL + "/" },
            { "@type": "ListItem", position: 2, name: "Programmes", item: SITE_URL + "/programs" },
            { "@type": "ListItem", position: 3, name: c.title, item: SITE_URL + "/programs/" + c.slug },
          ],
        },
      ],
    },
  });
}
