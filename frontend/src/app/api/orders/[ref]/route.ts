import { forward } from "@/lib/proxy";

export async function GET(req: Request, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  return forward(req, "/api/v1/public/orders/" + encodeURIComponent(ref));
}
