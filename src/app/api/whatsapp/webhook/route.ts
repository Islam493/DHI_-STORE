import { after } from "next/server";
import { VERIFY_TOKEN, markStatus, parseWebhook, validSignature } from "@/lib/whatsapp";
import { handleIncoming } from "@/lib/automation";

export const dynamic = "force-dynamic";

// Meta تتأكد من الرابط (مرة وحدة كي تربطو)
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get("hub.mode") === "subscribe" && VERIFY_TOKEN && u.searchParams.get("hub.verify_token") === VERIFY_TOKEN) {
    return new Response(u.searchParams.get("hub.challenge") || "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

// الرسائل الداخلة + حالة الرسائل (وصلت، تقرات...)
export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("bad signature", { status: 401 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return new Response("ok"); }
  const { messages, statuses } = parseWebhook(body);
  // نجاوبو Meta دركا، والخدمة تكمّل من بعد
  after(async () => {
    for (const s of statuses) await markStatus(s.id, s.status, s.error);
    for (const m of messages) { try { await handleIncoming(m); } catch (e) { console.error("wa incoming:", e); } }
  });
  return new Response("ok");
}
