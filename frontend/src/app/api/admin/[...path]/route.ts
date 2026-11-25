import { ADMIN_COOKIE, cookieValue, forward } from "@/lib/proxy";

// /api/admin/<anything> -> backend /api/v1/admin/<anything>, with the admin token from the httpOnly cookie.
async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const token = await cookieValue(ADMIN_COOKIE);
  if (!token) return Response.json({ detail: "Please sign in" }, { status: 401 });
  const { path } = await ctx.params;
  const qs = new URL(req.url).search;
  return forward(req, "/api/v1/admin/" + path.map(encodeURIComponent).join("/") + qs, { token });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
