// Same-origin API routes forward to the backend, so browsers never need the backend URL or a token.
import { cookies } from "next/headers";

import { BACKEND_URL } from "./backend";

export const DEMO_COOKIE = "ic_demo";
export const ADMIN_COOKIE = "ic_admin";

export async function forward(req: Request, backendPath: string, opts: { token?: string; method?: string } = {}): Promise<Response> {
  const method = opts.method || req.method;
  const headers: Record<string, string> = {};
  const ct = req.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;
  if (opts.token) headers.Authorization = "Bearer " + opts.token;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) headers["X-Forwarded-For"] = fwd;
  const body = method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();
  const r = await fetch(BACKEND_URL + backendPath, { method, headers, body, cache: "no-store" });
  const out: Record<string, string> = { "Content-Type": r.headers.get("content-type") || "application/json", "Cache-Control": "no-store" };
  const cd = r.headers.get("content-disposition");   // CSV exports keep their file name
  if (cd) out["Content-Disposition"] = cd;
  if (r.headers.get("x-content-type-options")) out["X-Content-Type-Options"] = "nosniff";
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
