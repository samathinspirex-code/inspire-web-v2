import { designHandler } from "@/lib/pages";

export const revalidate = 60;
export const GET = designHandler("Program", () => ({ seo: { path: "/programs", title: "Programmes | Inspire College", description: "HNDs, Foundations, top-up degrees, postgraduate diplomas and CPD short courses, 100% online." } }));
