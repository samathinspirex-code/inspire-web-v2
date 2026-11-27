import { DEMO_COOKIE } from "@/lib/proxy";
import { loginRoute } from "@/lib/session-routes";

export const POST = loginRoute("/api/v1/public/web/demo/signup", DEMO_COOKIE, 24);
