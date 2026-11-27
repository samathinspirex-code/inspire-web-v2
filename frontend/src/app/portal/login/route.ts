import { getDemoMe } from "@/lib/backend";
import { cookieValue, DEMO_COOKIE } from "@/lib/proxy";
import { renderPortalPage } from "@/lib/render";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (await getDemoMe(await cookieValue(DEMO_COOKIE))) {
    return Response.redirect(new URL("/portal", req.url), 307);
  }
  return renderPortalPage({ name: "Student", demo: { login: true }, seo: { title: "Log in to Inspire Brain | Inspire College", description: "Log in to Inspire Brain, the Inspire College student portal: live classes, recordings, assignments and your free demo class.", path: "/portal/login" } });
}
