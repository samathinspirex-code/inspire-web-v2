import { designHandler } from "@/lib/pages";

export const revalidate = 60;
export const GET = designHandler("Demo", () => ({ seo: { path: "/free-demo", title: "Free demo class | Inspire College", description: "Create a free account and try a real Inspire class in the Inspire Brain LMS." } }));
