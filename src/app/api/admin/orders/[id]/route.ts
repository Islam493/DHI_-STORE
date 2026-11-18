import { NextResponse } from "next/server";
import { dbDelete, dbSelect } from "@/lib/db";
import { updateOrder } from "@/lib/orders";
import { isStatus, type Order } from "@/lib/order-types";
import { getAllProducts } from "@/lib/catalog";
import { getSettings, getWilayas } from "@/lib/settings";
import { fail, guard } from "@/lib/admin-api";
import { carrier } from "@/lib/ecotrack";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  const [o] = await dbSelect<Order>("orders", { eq: { id }, limit: 1 }, { fresh: true });
  return o;
}

export async function GET(_req: Request, { params }: Ctx) {
  const g = await guard(); if (g) return g;
  const { id } = await params;
  try {
    const o = await load(id);
    if (!o) return NextResponse.json({ error: "الطلبية ما كانتش" }, { status: 404 });
    const [same, products, s] = await Promise.all([
      dbSelect<Order>("orders", { eq: { phone: o.phone }, order: ["created_at", "desc"], limit: 20, select: "id,status,created_at,product_name,total" }, { fresh: true }),
      getAllProducts(true),
      getSettings(true),
    ]);
    return NextResponse.json({
      order: o,
      image: products.find((p) => p.id === o.product_id)?.images[0] || null,
      others: same.filter((x) => x.id !== o.id),
      carrier: carrier.enabled,
      blocked: { phone: s.blocked.phones.includes(o.phone), ip: !!o.ip && s.blocked.ips.includes(o.ip) },
    });
  } catch (e) { return fail(e); }
}

const int = (v: unknown, min = 0, max = 10_000_000) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

// تعديل معلومات الطلبية (الاسم، الرقم، العنوان، الكمية، التوصيل...) ولا الحالة
export async function PATCH(req: Request, { params }: Ctx) {
  const g = await guard(); if (g) return g;
  const { id } = await params;
  try {
    const o = await load(id);
    if (!o) return NextResponse.json({ error: "الطلبية ما كانتش" }, { status: 404 });
    const b = await req.json().catch(() => ({}));
    const p: Partial<Order> = {};
    if (b.status !== undefined) { if (!isStatus(b.status)) return NextResponse.json({ error: "حالة غالطة" }, { status: 400 }); p.status = b.status; }
    const name = str(b.customer_name, 80); if (name !== undefined) { if (name.length < 2) return NextResponse.json({ error: "الاسم قصير" }, { status: 400 }); p.customer_name = name; }
    if (b.phone !== undefined) {
      const ph = String(b.phone).replace(/[\s.-]/g, "").replace(/^(\+213|00213)/, "0");
      if (!/^0[567]\d{8}$/.test(ph)) return NextResponse.json({ error: "رقم الهاتف غالط" }, { status: 400 });
      p.phone = ph;
    }
    if (b.wilaya_code !== undefined) {
      const w = (await getWilayas(true)).find((x) => x.code === Number(b.wilaya_code));
      if (!w) return NextResponse.json({ error: "ولاية غالطة" }, { status: 400 });
      p.wilaya_code = w.code; p.wilaya_name = w.name;
    }
    const commune = str(b.commune, 80); if (commune !== undefined) p.commune = commune;
    const address = str(b.address, 200); if (address !== undefined) p.address = address;
    const note = str(b.note, 300); if (note !== undefined) p.note = note;
    if (b.delivery_method !== undefined) p.delivery_method = b.delivery_method === "desk" ? "desk" : "home";
    for (const [k, max] of [["quantity", 100], ["unit_price", 10_000_000], ["shipping_fee", 100_000]] as const) {
      if (b[k] !== undefined) { const n = int(b[k], k === "quantity" ? 1 : 0, max); if (n === null) return NextResponse.json({ error: `قيمة غالطة: ${k}` }, { status: 400 }); p[k] = n; }
    }
    if (p.quantity !== undefined || p.unit_price !== undefined || p.shipping_fee !== undefined) {
      p.total = (p.unit_price ?? o.unit_price) * (p.quantity ?? o.quantity) + (p.shipping_fee ?? o.shipping_fee);
    }
    if (!Object.keys(p).length) return NextResponse.json({ error: "ما كانش تبديل" }, { status: 400 });
    await updateOrder(o, p);
    return NextResponse.json({ ok: true, order: { ...o, ...p } });
  } catch (e) { return fail(e); }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await guard(); if (g) return g;
  const { id } = await params;
  try { await dbDelete("orders", { id }); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
