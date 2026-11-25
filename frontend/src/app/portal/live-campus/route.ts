import { getBundle, getDemoMe } from "@/lib/backend";
import { cookieValue, DEMO_COOKIE } from "@/lib/proxy";
import { renderDesignPage } from "@/lib/render";

export const dynamic = "force-dynamic";

// Live Campus inside the demo LMS (same design as the public /live-campus page).
export async function GET(req: Request) {
  const me = await getDemoMe(await cookieValue(DEMO_COOKIE));
  if (!me) return Response.redirect(new URL("/portal/login", req.url), 307);
  const res = renderDesignPage("Live", await getBundle(), {
    seo: { title: "Live Campus · Inspire Brain demo", path: "/portal/live-campus", noindex: true },
    data: { demoUser: me.user.name.split(" ")[0] },
  });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
