import { demoSession, getBundle } from "@/lib/backend";
import { cookieValue, DEMO_COOKIE } from "@/lib/proxy";
import { renderDesignPage, wakingPage } from "@/lib/render";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Live Campus inside the demo LMS (same design as the public /live-campus page).
export async function GET(req: Request) {
  const { me, unavailable } = await demoSession(await cookieValue(DEMO_COOKIE));
  if (unavailable) return wakingPage();
  if (!me) return Response.redirect(new URL("/portal/login", req.url), 307);
  const res = renderDesignPage("Live", await getBundle(), {
    seo: { title: "Live Campus · Inspire Brain demo", path: "/portal/live-campus", noindex: true },
    data: { demoUser: me.user.name.split(" ")[0] },
  });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
