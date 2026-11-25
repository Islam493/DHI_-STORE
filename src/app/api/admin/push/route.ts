import { NextResponse } from "next/server";
import { addSub, publicKey, removeSub, sendPush, subCount } from "@/lib/push";
import { actor, fail, guard } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

// المفتاح العام (باش الجهاز يشترك) + شحال من جهاز مربوط
export async function GET() {
  const g = await guard("orders.view"); if (g) return g;
  try { return NextResponse.json({ publicKey: await publicKey(), devices: await subCount() }); }
  catch (e) { return fail(e); }
}

// الجهاز يشترك فالتنبيهات (ولا «جرّب»)
export async function POST(req: Request) {
  const g = await guard("orders.view"); if (g) return g;
  const b = await req.json().catch(() => ({}));
  const s = b.subscription;
  const valid = s && typeof s.endpoint === "string" && /^https:\/\//.test(s.endpoint) && typeof s.keys?.p256dh === "string" && typeof s.keys?.auth === "string";
  if (!valid) return NextResponse.json({ error: "اشتراك غالط" }, { status: 400 });
  try {
    if (b.test) {
      const n = await sendPush({ title: "✅ التنبيهات خدامة", body: "كي تدخل طلبية جديدة يجيك تنبيه كيما هذا 🛒", url: "/admin", tag: "test" }, s.endpoint);
      return NextResponse.json({ ok: n > 0 });
    }
    const devices = await addSub({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, by: await actor(), ua: String(req.headers.get("user-agent") || "").slice(0, 160) });
    return NextResponse.json({ ok: true, devices });
  } catch (e) { return fail(e); }
}

export async function DELETE(req: Request) {
  const g = await guard("orders.view"); if (g) return g;
  const { endpoint } = await req.json().catch(() => ({}));
  if (typeof endpoint !== "string") return NextResponse.json({ error: "غالط" }, { status: 400 });
  try { await removeSub(endpoint); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
