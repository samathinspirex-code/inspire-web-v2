import { designHandler } from "@/lib/pages";

export const revalidate = 60;
export const GET = designHandler("Main", () => ({ hash: "about", seo: { path: "/about", title: "About Inspire College", description: "Who we are, our values and the leadership team behind Inspire College." } }));
