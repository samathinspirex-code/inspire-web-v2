// Any URL no other route, redirect or proxy rule handles: the site-styled 404 page.
import { getBundle } from "@/lib/backend";
import { notFoundPage } from "@/lib/chrome";

export async function GET(req: Request) {
  return notFoundPage(await getBundle(), new URL(req.url).pathname);
}
