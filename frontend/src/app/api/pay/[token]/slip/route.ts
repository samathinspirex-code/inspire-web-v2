import { forward } from "@/lib/proxy";

// Multipart slip upload (photo or PDF), passed through to the backend which checks type and size.
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (Number(req.headers.get("content-length") || 0) > 6 * 1024 * 1024) return Response.json({ detail: "The file is too large (max 5 MB)." }, { status: 413 });
  return forward(req, "/api/v1/public/pay/" + encodeURIComponent(token) + "/slip");
}
