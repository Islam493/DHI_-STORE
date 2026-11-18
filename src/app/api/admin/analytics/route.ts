import { NextResponse } from "next/server";
import { getAllProducts } from "@/lib/catalog";
import { daily, productsPerf, wilayasPerf } from "@/lib/stats";
import { fail, guard } from "@/lib/admin-api";

export const dynamic = "force-dynamic";
const day = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const g = await guard("stats.view"); if (g) return g;
  const u = new URL(req.url);
  const today = new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
  const fromD = day.test(u.searchParams.get("from") || "") ? u.searchParams.get("from")! : new Date(Date.now() + 3600_000 - 29 * 86400_000).toISOString().slice(0, 10);
  const toD = day.test(u.searchParams.get("to") || "") ? u.searchParams.get("to")! : today;
  const product = u.searchParams.get("product") || null;
  const from = `${fromD}T00:00:00+01:00`;
  const to = new Date(new Date(`${toD}T00:00:00+01:00`).getTime() + 86400_000).toISOString();
  try {
    const products = await getAllProducts(true);
    const costs = Object.fromEntries(products.map((p) => [p.id, p.cost ?? null]));
    const [days, perf, wil] = await Promise.all([daily(from, to, product, costs), productsPerf(from, to), wilayasPerf(from, to)]);
    const t = days.reduce((a, d) => {
      for (const k of Object.keys(a) as (keyof typeof a)[]) a[k] += Number(d[k]) || 0;
      return a;
    }, { orders: 0, confirmed: 0, delivered: 0, returned: 0, cancelled: 0, gross: 0, delivered_revenue: 0, delivered_product_revenue: 0, delivered_cost: 0, delivered_missing_cost: 0 });
    const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
    const valid = t.orders - t.cancelled;
    return NextResponse.json({
      range: { from: fromD, to: toD }, product,
      days, totals: t,
      kpi: {
        aov: valid ? Math.round(t.gross / valid) : 0,
        confirmRate: pct(t.confirmed, t.orders),
        cancelRate: pct(t.cancelled, t.orders),
        deliveryRate: pct(t.delivered, t.delivered + t.returned),
        returnRate: pct(t.returned, t.delivered + t.returned),
        // الربح: غير إذا سعر الشراء معروف لكل الطلبيات المستلمة
        profit: t.delivered && t.delivered_missing_cost === 0 ? t.delivered_product_revenue - t.delivered_cost : null,
        profitPartial: t.delivered_missing_cost > 0,
      },
      products: perf.map((p) => ({ ...p, image: products.find((x) => x.id === p.product_id)?.images[0] || null })),
      wilayas: wil,
      productList: products.map((p) => ({ id: p.id, name: p.name })),
    });
  } catch (e) { return fail(e); }
}
