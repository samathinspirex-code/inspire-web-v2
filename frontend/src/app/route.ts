import { SITE_URL } from "@/lib/backend";
import { designHandler } from "@/lib/pages";

export const revalidate = 60;
export const GET = designHandler("Main", (b) => ({
  seo: {
    path: "/",
    title: "Inspire College — Sri Lanka's first tech-enabled online higher education institution",
    jsonLd: [
      {
        "@context": "https://schema.org", "@type": "CollegeOrUniversity", "@id": SITE_URL + "/#org", name: "Inspire College", url: SITE_URL + "/",
        logo: SITE_URL + "/icon.png", image: SITE_URL + "/assets/b902c0e1d0b5e18b502f5249ee882e83.webp",
        description: b.settings.seo?.default_description || undefined,
        address: { "@type": "PostalAddress", addressCountry: "LK" },
        ...(b.settings.contact?.phone_display ? { telephone: b.settings.contact.phone_display } : {}),
        ...(b.settings.contact?.email ? { email: b.settings.contact.email } : {}),
      },
      { "@context": "https://schema.org", "@type": "WebSite", name: "Inspire College", url: SITE_URL + "/", publisher: { "@id": SITE_URL + "/#org" } },
    ],
  },
}));
