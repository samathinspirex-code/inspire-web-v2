// Demo login routes: call the API, keep the token in an httpOnly cookie (never readable by page scripts).
import { BACKEND_URL } from "./backend";
import { errorBody, proxyHeaders, sessionCookie } from "./proxy";

export function loginRoute(backendPath: string, cookie: string, fallbackHours: number) {
  return async function POST(req: Request): Promise<Response> {
    let r: Response;
    try {
      r = await fetch(BACKEND_URL + backendPath, {
        method: "POST", headers: { "Content-Type": "application/json", ...proxyHeaders(req) }, body: await req.text(), cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      return Response.json({ detail: "We couldn't reach the server. Please try again in a moment." }, { status: 503 });
    }
    if (!r.ok) {
      const e = await errorBody(r);
      // 404 on reset means "no such demo account" (the page sends them to sign up); keep the status.
      return Response.json({ detail: e.detail || "Sign-in failed" }, { status: r.status });
    }
    const j = await r.json().catch(() => ({}));
    if (!j.token) return Response.json({ detail: "Sign-in failed" }, { status: 400 });
    const exp = j.expires_at ? new Date(j.expires_at) : new Date(Date.now() + fallbackHours * 3600_000);
    return Response.json({ ok: true, user: j.user }, { headers: { "Set-Cookie": sessionCookie(cookie, j.token, exp), "Cache-Control": "no-store" } });
  };
}

export function logoutRoute(cookie: string) {
  return async function POST(): Promise<Response> {
    return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(cookie, "", null) } });
  };
}
