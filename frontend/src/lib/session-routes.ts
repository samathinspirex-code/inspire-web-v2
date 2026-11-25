// Login routes: call the backend, keep the token in an httpOnly cookie (never readable by page scripts).
import { BACKEND_URL } from "./backend";
import { sessionCookie } from "./proxy";

export function loginRoute(backendPath: string, cookie: string, fallbackHours: number) {
  return async function POST(req: Request): Promise<Response> {
    const r = await fetch(BACKEND_URL + backendPath, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: await req.text(), cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.token) {
      return Response.json({ detail: j.detail || "Sign-in failed" }, { status: r.status === 200 ? 400 : r.status });
    }
    const exp = j.expires_at ? new Date(j.expires_at) : new Date(Date.now() + fallbackHours * 3600_000);
    return Response.json({ ok: true, user: j.user }, { headers: { "Set-Cookie": sessionCookie(cookie, j.token, exp), "Cache-Control": "no-store" } });
  };
}

export function logoutRoute(cookie: string) {
  return async function POST(): Promise<Response> {
    return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(cookie, "", null) } });
  };
}
