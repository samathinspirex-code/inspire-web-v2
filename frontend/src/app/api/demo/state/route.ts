import { cookieValue, DEMO_COOKIE, forward } from "@/lib/proxy";

export async function PUT(req: Request) {
  const token = await cookieValue(DEMO_COOKIE);
  if (!token) return Response.json({ detail: "Not signed in" }, { status: 401 });
  return forward(req, "/api/v1/demo/state", { token });
}
