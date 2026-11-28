import { after } from "next/server";
import { parseWebhook, validSignature, verifyToken } from "@/lib/social/meta";
import { handle } from "@/lib/social/bot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Meta تتأكد من الرابط (مرة وحدة كي تربطو التطبيق)
export async function GET(req: Request) {
  const u = new URL(req.url);
  const want = verifyToken();
  if (u.searchParams.get("hub.mode") === "subscribe" && want && u.searchParams.get("hub.verify_token") === want) {
    return new Response(u.searchParams.get("hub.challenge") || "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

// الرسائل والكومونتيرات تاع فيسبوك وانستغرام
export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("bad signature", { status: 401 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return new Response("ok"); }
  const events = parseWebhook(body);
  // نجاوبو Meta دركا (لازم فأقل من 20 ثانية)، والردود تخرج من بعد
  after(async () => {
    for (const ev of events) { try { await handle(ev); } catch (e) { console.error("social:", e); } }
  });
  return new Response("ok");
}
