import { forward } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // The same public feed for every visitor: the CDN answers repeat polls, so the API sees about one request per 10 s.
  return forward(req, "/api/v1/public/web/live-feed", { cdnSeconds: 10 });
}
