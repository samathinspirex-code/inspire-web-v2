import { forward } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return forward(req, "/api/v1/live/feed");
}
