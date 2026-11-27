// Same-origin API routes forward to the Inspire API (AWS), so browsers never need the API address or a token.
import { cookies } from "next/headers";

import { BACKEND_URL } from "./backend";

export const DEMO_COOKIE = "ic_demo";

/** Lets the API rate-limit per visitor: it trusts X-Web-Visitor-IP only with the shared WEB_PROXY_SECRET. */
export function proxyHeaders(req?: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const secret = process.env.WEB_PROXY_SECRET;
  if (secret) out["X-Web-Proxy-Key"] = secret;
  const ip = req ? (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "" : "";
  if (ip) out["X-Web-Visitor-IP"] = ip.slice(0, 64);
  return out;
}

/** The API answers errors as {error: {code, message}}; the site's scripts read {detail}. */
export async function errorBody(r: Response): Promise<{ detail: string; code?: string }> {
  const j = await r.json().catch(() => null);
  const e = j?.error;
  if (e && typeof e === "object") {
    const extra = Array.isArray(e.details) && e.details.length ? ` (${e.details.map((d: { field?: string; issue?: string }) => `${d.field}: ${d.issue}`).join(", ")})` : "";
    return { detail: String(e.message || "Something went wrong") + extra, code: e.code };
  }
  return { detail: typeof j?.detail === "string" ? j.detail : "Something went wrong. Please try again." };
}

export async function forward(req: Request, backendPath: string, opts: { token?: string; method?: string; body?: BodyInit; contentType?: string } = {}): Promise<Response> {
  const method = opts.method || req.method;
  const headers: Record<string, string> = proxyHeaders(req);
  const ct = opts.contentType || req.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;
  if (opts.token) headers.Authorization = "Bearer " + opts.token;
  const body = method === "GET" || method === "HEAD" ? undefined : opts.body ?? (await req.arrayBuffer());
  let r: Response;
  try {
    r = await fetch(BACKEND_URL + backendPath, { method, headers, body, cache: "no-store", signal: AbortSignal.timeout(30000) });
  } catch {
    return Response.json({ detail: "We couldn't reach the server. Please try again in a moment." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!r.ok) {
    return Response.json(await errorBody(r), { status: r.status, headers: { "Cache-Control": "no-store" } });
  }
  const out: Record<string, string> = { "Content-Type": r.headers.get("content-type") || "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  return new Response(r.body, { status: r.status, headers: out });
}

export async function cookieValue(name: string): Promise<string | undefined> {
  return (await cookies()).get(name)?.value;
}

export function sessionCookie(name: string, value: string, expires: Date | null): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const exp = expires ? `; Expires=${expires.toUTCString()}` : "; Max-Age=0";
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax${secure}${exp}`;
}
