import { NextResponse } from "next/server";
import { dbSelect } from "@/lib/db";
import { fail, guard } from "@/lib/admin-api";
import { groups, type Order, type Status } from "@/lib/order-types";
import { getAllProducts } from "@/lib/catalog";
import { carrier } from "@/lib/ecotrack";

export const dynamic = "force-dynamic";

// الجزائر: UTC+1 طول العام
const H = 3600_000, D = 24 * H;
const dayStart = (daysAgo = 0) => Math.floor((Date.now() + H) / D) * D - H - daysAgo * D;
const dayKey = (t: number) => Math.floor((t + H) / D);

// وقتاش وصلت الطلبية لهاد المجموعة (من التاريخ، ولا وقت الطلب إذا ما كانش تاريخ)
function reachedAt(o: Order, set: Status[]) {
  const h = (o.history || []).find((x) => set.includes(x.s as Status));
  if (h) return new Date(h.at).getTime();
  return set.includes(o.status as Status) ? new Date(o.created_at).getTime() : null;
}

export async function GET() {
  const g = await guard(); if (g) return g;
  try {
    const since = new Date(dayStart(29)).toISOString();
    const rows = await dbSelect<Order>("orders", { gte: { created_at: since }, order: ["created_at", "desc"], limit: 10000 }, { fresh: true });
    const latest = rows.slice(0, 6);
    const today = dayKey(Date.now()), yesterday = today - 1;

    const count = (fn: (o: Order) => number | null, day: number) => rows.filter((o) => { const t = fn(o); return t !== null && dayKey(t) === day; }).length;
    const created = (o: Order) => new Date(o.created_at).getTime();
    const conf = (o: Order) => reachedAt(o, groups.confirmed);
    const canc = (o: Order) => reachedAt(o, groups.cancelled);
    const card = (fn: (o: Order) => number | null) => ({ today: count(fn, today), yesterday: count(fn, yesterday) });
    const revenue = (day: number) => rows.filter((o) => { const t = conf(o); return t !== null && dayKey(t) === day && o.status !== "returned"; }).reduce((s, o) => s + o.total, 0);

    const chart = Array.from({ length: 14 }, (_, i) => {
      const day = today - 13 + i;
      return { day: new Date(day * D).toISOString().slice(5, 10), orders: count(created, day), confirmed: count(conf, day) };
    });

    const products = await getAllProducts(true);
    const by = new Map<string, number>();
    for (const o of rows) by.set(o.product_id, (by.get(o.product_id) || 0) + 1);
    const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => {
      const p = products.find((x) => x.id === id);
      return { id, name: p?.name || rows.find((o) => o.product_id === id)?.product_name || id, image: p?.images[0] || null, orders: n, share: Math.round((n / rows.length) * 100) };
    });

    const closed = rows.filter((o) => o.status === "delivered" || o.status === "returned");
    return NextResponse.json({
      cards: { orders: card(created), confirmed: card(conf), cancelled: card(canc), revenue: { today: revenue(today), yesterday: revenue(yesterday) } },
      pending: rows.filter((o) => groups.pending.includes(o.status as Status)).length,
      month: { orders: rows.length, confirmRate: rows.length ? Math.round((rows.filter((o) => conf(o) !== null).length / rows.length) * 100) : null, deliveryRate: closed.length ? Math.round((closed.filter((o) => o.status === "delivered").length / closed.length) * 100) : null },
      chart, top, latest, carrier: carrier.enabled,
    });
  } catch (e) { return fail(e); }
}
