import { legalHandler } from "@/lib/legal-page";

export const revalidate = 3600;
export const GET = legalHandler("terms-conditions");
