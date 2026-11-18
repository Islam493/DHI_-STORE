import { NextResponse } from "next/server";
import { dbSelect } from "@/lib/db";
import { currentUser, fail, guard } from "@/lib/admin-api";
import { can } from "@/lib/perms";
import { getAllProducts } from "@/lib/catalog";
import { daily, dzDate, dzDayStart, orderCounts, productsPerf } from "@/lib/stats";
import { carrier } from "@/lib/ecotrack";
import type { Order } from "@/lib/order-types";

export const dynamic = "force-dynamic";

// الرئيسية: كل الأرقام من قاعدة البيانات (ما كانش أرقام مخترعة)
export async function GET() {
  const g = await guard("orders.view"); if (g) return g;
  const me = await currentUser();
  const money = can(me?.r, "stats.view");
  try {
    const from = dzDayStart(29).toISOString(), to = new Date(Date.now() + 86400_000).toISOString();
    const products = await getAllProducts(true);
    const [counts, days, perf, latest] = await Promise.all([
      orderCounts(),
      daily(from, to, null, Object.fromEntries(products.map((p) => [p.id, p.cost ?? null]))),
      productsPerf(from, to),
      dbSelect<Order>("orders", { order: ["created_at", "desc"], limit: 6 }, { fresh: true }),
    ]);
    const today = dzDate(Date.now()), yest = dzDate(Date.now() - 86400_000), week = dzDate(dzDayStart(6).getTime() + 3600_000);
    const sum = (f: (d: (typeof days)[number]) => boolean, k: "orders" | "gross" | "delivered_revenue" | "confirmed" | "cancelled") => days.filter(f).reduce((a, d) => a + Number(d[k]), 0);
    const sales = (k: "gross" | "delivered_revenue") => ({ today: sum((d) => d.day === today, k), yesterday: sum((d) => d.day === yest, k), week: sum((d) => d.day >= week, k), month: sum(() => true, k) });

    let activity: { at: string; user_name: string; action: string; target: string | null }[] = [];
    if (can(me?.r, "audit.view")) {
      try { activity = await dbSelect("audit_log", { order: ["at", "desc"], limit: 8, select: "at,user_name,action,target" }, { fresh: true }); } catch {}
    }
    const lowStock = products.filter((p) => p.active && typeof p.stock === "number" && p.stock <= (p.lowStock ?? 3)).map((p) => ({ id: p.id, name: p.name, stock: p.stock as number }));

    return NextResponse.json({
      counts,
      today: { orders: sum((d) => d.day === today, "orders"), yesterday: sum((d) => d.day === yest, "orders"), confirmed: sum((d) => d.day === today, "confirmed"), cancelled: sum((d) => d.day === today, "cancelled") },
      sales: money ? { gross: sales("gross"), delivered: sales("delivered_revenue") } : null,
      chart: days.slice(-14).map((d) => ({ day: d.day, orders: d.orders, confirmed: d.confirmed, delivered: d.delivered })),
      top: perf.slice(0, 5).map((p) => ({ ...p, image: products.find((x) => x.id === p.product_id)?.images[0] || null })),
      lowStock, latest, activity, carrier: carrier.enabled,
    });
  } catch (e) { return fail(e); }
}
