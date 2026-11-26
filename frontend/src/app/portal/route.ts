import { demoSession } from "@/lib/backend";
import { cookieValue, DEMO_COOKIE, sessionCookie } from "@/lib/proxy";
import { renderPortalPage, wakingPage } from "@/lib/render";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Portal button: dashboard when signed in to a demo account, otherwise the demo login screen.
export async function GET(req: Request) {
  const token = await cookieValue(DEMO_COOKIE);
  const { me, unavailable } = await demoSession(token);
  if (unavailable) return wakingPage();   // backend asleep/unreachable: keep the login, retry
  if (!me) {
    const headers: Record<string, string> = { Location: new URL("/portal/login" + (token ? "?expired=1" : ""), req.url).toString() };
    if (token) headers["Set-Cookie"] = sessionCookie(DEMO_COOKIE, "", null);
    return new Response(null, { status: 307, headers });
  }
  return renderPortalPage({
    name: me.user.name,
    demo: { user: me.user, state: me.state, expires_at: me.expires_at },
    seo: { title: "Inspire Brain · Demo", path: "/portal" },
  });
}
