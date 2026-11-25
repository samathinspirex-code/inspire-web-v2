import { designHandler } from "@/lib/pages";

export const revalidate = 60;
export const GET = designHandler("Aptitude", () => ({ seo: { path: "/aptitude", title: "Find your programme | Inspire College", description: "Answer 8 quick questions and get matched to the right programme." } }));
