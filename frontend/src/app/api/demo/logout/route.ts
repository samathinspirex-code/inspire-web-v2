import { DEMO_COOKIE } from "@/lib/proxy";
import { logoutRoute } from "@/lib/session-routes";

export const POST = logoutRoute(DEMO_COOKIE);
