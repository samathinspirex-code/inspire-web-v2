import { ADMIN_COOKIE } from "@/lib/proxy";
import { logoutRoute } from "@/lib/session-routes";

export const POST = logoutRoute(ADMIN_COOKIE);
