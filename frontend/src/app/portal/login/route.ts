import { getDemoMe } from "@/lib/backend";
import { cookieValue, DEMO_COOKIE } from "@/lib/proxy";
import { renderPortalPage } from "@/lib/render";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (await getDemoMe(await cookieValue(DEMO_COOKIE))) {
    return Response.redirect(new URL("/portal", req.url), 307);
  }
  return renderPortalPage({ name: "Student", demo: { login: true }, seo: { title: "Log in · Inspire Brain demo", path: "/portal/login" } });
}
