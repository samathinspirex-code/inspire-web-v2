import { designHandler } from "@/lib/pages";

export const revalidate = 60;
export const GET = designHandler("Live", () => ({ seo: { path: "/live-campus", title: "Live Campus | Inspire College", description: "What is happening across the Inspire campus right now." } }));
