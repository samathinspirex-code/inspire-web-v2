import { forward } from "@/lib/proxy";

const MAX = 4 * 1024 * 1024; // Vercel rejects request bodies above ~4.5 MB

// Bank slip (photo or PDF): the browser sends a normal form upload; the API takes it as JSON and checks type and size again.
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (Number(req.headers.get("content-length") || 0) > MAX + 64 * 1024) return Response.json({ detail: "The file is too large (max 4 MB)." }, { status: 413 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ detail: "Please choose your slip file." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return Response.json({ detail: "Please choose your slip file." }, { status: 400 });
  if (file.size > MAX) return Response.json({ detail: "The file is too large (max 4 MB)." }, { status: 413 });
  const body = JSON.stringify({
    file_name: (file.name || "slip").slice(0, 200),
    content_type: file.type || "",
    data_base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
    amount: Number(form.get("amount") || 0),
    paid_on: String(form.get("paid_on") || "") || null,
    reference: String(form.get("reference") || "").slice(0, 120),
    note: String(form.get("note") || "").slice(0, 500),
  });
  return forward(req, "/api/v1/public/web/pay/" + encodeURIComponent(token) + "/slip", { method: "POST", body, contentType: "application/json" });
}
