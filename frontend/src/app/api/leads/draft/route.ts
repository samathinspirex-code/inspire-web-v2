import { forward } from "@/lib/proxy";

// Checkout lead: sent once name, email and phone are filled in, before any payment.
export async function POST(req: Request) {
  return forward(req, "/api/v1/public/web/leads/draft");
}
