import { designHandler } from "@/lib/pages";

export const revalidate = 60;
export const GET = designHandler("LMS", () => ({ seo: { path: "/brain", title: "Inspire Brain student portal | Inspire College", description: "A tour of Inspire Brain: AI study buddy, leaderboards, rewards and more." } }));
