import { designHandler } from "@/lib/pages";

export const revalidate = 60;
export const GET = designHandler("Main", () => ({
  seo: {
    path: "/",
    title: "Inspire College — Sri Lanka's first tech-enabled online higher education institution",
    jsonLd: { "@context": "https://schema.org", "@type": "CollegeOrUniversity", name: "Inspire College", url: process.env.NEXT_PUBLIC_SITE_URL || "https://inspirecollege.lk" },
  },
}));
