import { levelHandler } from "@/lib/pages";

export const revalidate = 60;
export const GET = levelHandler("/short-courses", "Short course", "Short courses", "CPD short courses in AI, data, cyber security and marketing.");
