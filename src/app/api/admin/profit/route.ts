import { NextResponse } from "next/server";
import { dbSelectAll, dbUpdate } from "@/lib/db";
import { getAllProducts } from "@/lib/catalog";
import { getSettings, saveSettings } from "@/lib/settings";
import { carrier, carrierFees } from "@/lib/ecotrack";
import { defaultWilayas } from "@/lib/wilayas";
import { audit } from "@/lib/audit";
import { actor, fail, guard, refreshSite } from "@/lib/admin-api";
import type { Order } from "@/lib/order-types";

export const dynamic = "force-dynamic";
const day = /^\d{4}-\d{2}-\d{2}$/;
const PIPE = ["confirmed", "preparing", "ready", "shipped"];

// الربح = اللي يخلصو الزبون − سعر الشراء × الكمية − سعر التوصيل (World Express) − العمولة
// المرجوع = خسارة: سعر التوصيل + مصاريف الإرجاع
export async function GET(req: Request) {
  const g = await guard("stats.view"); if (g) return g;
  const u = new URL(req.url);
  const today = new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
  const fromD = day.test(u.searchParams.get("from") || "") ? u.searchParams.get("from")! : new Date(Date.now() + 3600_000 - 29 * 86400_000).toISOString().slice(0, 10);
  const toD = day.test(u.searchParams.get("to") || "") ? u.searchParams.get("to")! : today;
  try {
    const [products, s] = await Promise.all([getAllProducts(true), getSettings(true)]);
    const orders = await dbSelectAll<Order>("orders", {
      select: "id,created_at,status,customer_name,wilaya_code,wilaya_name,delivery_method,product_id,product_name,quantity,unit_price,shipping_fee,total,tracking",
      in: { status: ["delivered", "returned", ...PIPE] },
      gte: { created_at: `${fromD}T00:00:00+01:00` },
      lt: { created_at: new Date(new Date(`${toD}T00:00:00+01:00`).getTime() + 86400_000).toISOString() },
      order: ["created_at", "desc"],
    });
    const cost = (id: string) => products.find((p) => p.id === id)?.cost ?? null;
    const fee = (o: Order) => s.profit.carrierFees[o.wilaya_code]?.[o.delivery_method === "desk" ? "desk" : "home"] ?? null;
    const calc = (o: Order) => {
      const c = cost(o.product_id), f = fee(o), cod = Math.round((o.total * s.profit.codPercent) / 100);
      if (o.status === "returned") return { goods: 0, fee: f ?? 0, cod: 0, profit: -((f ?? 0) + s.profit.returnFee), missing: f === null };
      return { goods: (c ?? 0) * o.quantity, fee: f ?? 0, cod, profit: o.total - (c ?? 0) * o.quantity - (f ?? 0) - cod, missing: c === null || f === null };
    };

    const sum = { delivered: 0, revenue: 0, goods: 0, carrier: 0, cod: 0, deliveredProfit: 0, returned: 0, returnLoss: 0, pipeline: 0, pipelineProfit: 0, missing: 0 };
    const byProduct = new Map<string, { product_id: string; name: string; delivered: number; returned: number; revenue: number; goods: number; carrier: number; profit: number }>();
    const rows = orders.map((o) => {
      const r = calc(o);
      if (r.missing) sum.missing++;
      const bp = byProduct.get(o.product_id) || { product_id: o.product_id, name: o.product_name, delivered: 0, returned: 0, revenue: 0, goods: 0, carrier: 0, profit: 0 };
      if (o.status === "delivered") {
        sum.delivered++; sum.revenue += o.total; sum.goods += r.goods; sum.carrier += r.fee; sum.cod += r.cod; sum.deliveredProfit += r.profit;
        bp.delivered++; bp.revenue += o.total; bp.goods += r.goods; bp.carrier += r.fee + r.cod; bp.profit += r.profit;
      } else if (o.status === "returned") {
        sum.returned++; sum.returnLoss += r.profit; bp.returned++; bp.carrier += r.fee; bp.profit += r.profit;
      } else {
        sum.pipeline++; sum.pipelineProfit += r.profit;
      }
      byProduct.set(o.product_id, bp);
      return { ...o, ...r };
    });
    const net = sum.deliveredProfit + sum.returnLoss;
    return NextResponse.json({
      range: { from: fromD, to: toD },
      summary: { ...sum, net, margin: sum.revenue ? Math.round((net / sum.revenue) * 1000) / 10 : null },
      products: [...byProduct.values()].sort((a, b) => b.profit - a.profit),
      orders: rows.filter((o) => o.status === "delivered" || o.status === "returned").slice(0, 100),
      costs: products.map((p) => ({ id: p.id, name: p.name, image: p.images[0] || null, price: p.price, cost: p.cost ?? null })),
      settings: s.profit,
      wilayas: defaultWilayas.map((w) => ({ code: w.code, name: w.name })),
      carrierConnected: carrier.enabled,
    });
  } catch (e) { return fail(e); }
}

const num = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : null);

export async function POST(req: Request) {
  const g = await guard("stats.view"); if (g) return g;
  const b = await req.json().catch(() => ({}));
  const by = await actor();
  try {
    if (b.action === "fetch_fees") {
      const r = await carrierFees();
      return NextResponse.json({ ok: true, fees: r.fees, found: Object.keys(r.fees).length, keys: r.keys });
    }
    if (b.action === "save_fees") {
      const fees: Record<string, { home: number | null; desk: number | null }> = {};
      for (const w of defaultWilayas) { const x = b.carrierFees?.[w.code]; if (x) fees[w.code] = { home: num(x.home), desk: num(x.desk) }; }
      await saveSettings({ profit: { carrierFees: fees, returnFee: num(b.returnFee) ?? 0, codPercent: Math.min(20, Math.max(0, Number(b.codPercent) || 0)) } });
      await audit(by, "settings.edit", "profit");
      return NextResponse.json({ ok: true });
    }
    if (b.action === "save_costs") {
      const costs = (b.costs || {}) as Record<string, unknown>;
      for (const [id, v] of Object.entries(costs).slice(0, 500)) {
        try { await dbUpdate("products", { id }, { cost: num(v) }); }
        catch (e) {
          if (/PGRST204|column/.test(String(e))) return NextResponse.json({ error: "لازم تنفّذ كود SQL الجديد فـ Supabase (خانة سعر الشراء)" }, { status: 409 });
          throw e;
        }
      }
      refreshSite("catalog");
      await audit(by, "product.edit", "costs", { count: Object.keys(costs).length });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "عملية غالطة" }, { status: 400 });
  } catch (e) { return fail(e); }
}
