import { NextResponse, after } from "next/server";
import { audit } from "@/lib/audit";
import { dbSelect } from "@/lib/db";
import { shipOrder } from "@/lib/shipping";
import { onShipped } from "@/lib/automation";
import type { Order } from "@/lib/order-types";
import { actor, fail, guard } from "@/lib/admin-api";

// يبعث الطلبية لـ World Express ويحفظ رقم التتبع
export async function POST(req: Request) {
  const g = await guard("orders.ship"); if (g) return g;
  const b = await req.json().catch(() => ({}));
  try {
    const [o] = await dbSelect<Order>("orders", { eq: { id: String(b.id || "") }, limit: 1 }, { fresh: true });
    if (!o) return NextResponse.json({ error: "الطلبية ما كانتش" }, { status: 404 });
    if (!("tracking" in o)) return NextResponse.json({ error: "لازم تنفّذ كود SQL تاع التوصيل فـ Supabase قبل (خانة tracking ما كانتش)" }, { status: 409 });
    if (o.tracking) return NextResponse.json({ error: `الطلبية مبعوثة ديجا (${o.tracking})` }, { status: 409 });
    const commune = String(b.commune || "").trim();
    if (!commune) return NextResponse.json({ error: "اختار البلدية" }, { status: 400 });
    const montant = Math.round(Number(b.montant));
    if (!(montant >= 0)) return NextResponse.json({ error: "المبلغ غالط" }, { status: 400 });
    const by = await actor();
    const r = await shipOrder(o, { commune, montant, stop_desk: b.stop_desk === 1 || b.stop_desk === true, remarque: String(b.remarque ?? o.note ?? "") }, by);
    const { tracking, shipped_at } = r;
    after(() => onShipped(r.order));
    await audit(by, "order.ship", o.id, { tracking });
    return NextResponse.json({ ok: true, tracking, shipped_at });
  } catch (e) { return fail(e); }
}
