import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/backend";

export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_NOINDEX === "1") return { rules: [{ userAgent: "*", disallow: "/" }] };   // hosted preview
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/portal", "/api/", "/payment/", "/pay/"] }], sitemap: SITE_URL + "/sitemap.xml" };
}
