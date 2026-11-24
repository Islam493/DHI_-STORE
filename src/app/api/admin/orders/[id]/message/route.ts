import { NextResponse } from "next/server";
import { dbSelect } from "@/lib/db";
import { sendText, wa } from "@/lib/whatsapp";
import type { Order } from "@/lib/order-types";
import { actor, fail, guard } from "@/lib/admin-api";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// رد على الزبون من اللوحة (واتساب يسمح غير إذا الزبون بعثلنا فآخر 24 ساعة)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard("orders.edit"); if (g) return g;
  const { id } = await params;
  const { text } = await req.json().catch(() => ({}));
  const body = typeof text === "string" ? text.trim().slice(0, 1000) : "";
  if (!body) return NextResponse.json({ error: "اكتب الرسالة" }, { status: 400 });
  if (!wa.enabled) return NextResponse.json({ error: "الواتساب مازال ما تربطش (شوف صفحة الأتمتة)" }, { status: 409 });
  try {
    const [o] = await dbSelect<Order>("orders", { eq: { id }, limit: 1 }, { fresh: true });
    if (!o) return NextResponse.json({ error: "الطلبية ما كانتش" }, { status: 404 });
    try { await sendText(o.phone, body, o.id, "staff"); }
    catch (e) {
      const m = (e as Error).message;
      return NextResponse.json({ error: /24|window|re-engage|131047/i.test(m) ? "فاتو 24 ساعة من آخر رسالة تاع الزبون: واتساب ما يخليش تبعث رسالة عادية. عيّطلو ولا استنى يبعثلك." : `ما خرجتش: ${m}` }, { status: 400 });
    }
    await audit(await actor(), "order.whatsapp", o.id, {});
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
