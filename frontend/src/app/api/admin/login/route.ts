import { ADMIN_COOKIE } from "@/lib/proxy";
import { loginRoute } from "@/lib/session-routes";

export const POST = loginRoute("/api/v1/admin/auth/login", ADMIN_COOKIE, 12);
