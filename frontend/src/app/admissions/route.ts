import { designHandler } from "@/lib/pages";

export const revalidate = 60;
export const GET = designHandler("Enrol", () => ({ seo: { path: "/admissions", title: "Apply now | Inspire College", description: "Apply online in a few steps and reserve your seat in the next intake." } }));
