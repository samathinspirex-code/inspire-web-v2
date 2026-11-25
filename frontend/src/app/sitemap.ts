import type { MetadataRoute } from "next";

import { getBundle, getNewsList, SITE_URL } from "@/lib/backend";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [b, news] = await Promise.all([getBundle(), getNewsList()]);
  const fixed = ["", "/programs", "/hnd-courses", "/business-degrees", "/computing-degrees", "/postgraduate-degrees", "/short-courses",
    "/free-demo", "/aptitude", "/admissions", "/about", "/contact", "/brain", "/live-campus", "/news", "/privacy-policy", "/refund-policy", "/terms-conditions"];
  return [
    ...fixed.map((p) => ({ url: SITE_URL + p, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...b.courses.map((c) => ({ url: `${SITE_URL}/programs/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...news.map((n) => ({ url: `${SITE_URL}/news/${n.slug}`, lastModified: n.published_at, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
