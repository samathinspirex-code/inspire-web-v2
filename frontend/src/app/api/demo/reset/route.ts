import { DEMO_COOKIE } from "@/lib/proxy";
import { loginRoute } from "@/lib/session-routes";

// Forgot password (demo accounts): sets the new password and signs in, like login.
export const POST = loginRoute("/api/v1/demo/reset-password", DEMO_COOKIE, 24);
