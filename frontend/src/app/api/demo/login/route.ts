import { DEMO_COOKIE } from "@/lib/proxy";
import { loginRoute } from "@/lib/session-routes";

export const POST = loginRoute("/api/v1/public/web/demo/login", DEMO_COOKIE, 24);
