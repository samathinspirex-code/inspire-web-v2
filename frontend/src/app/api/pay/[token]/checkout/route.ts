import { forward } from "@/lib/proxy";

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  return forward(req, "/api/v1/public/pay/" + encodeURIComponent(token) + "/checkout");
}
