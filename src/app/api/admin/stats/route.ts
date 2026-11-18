import { NextResponse } from "next/server";
import { dbSelect } from "@/lib/db";
import { fail, guard } from "@/lib/admin-api";
import type { Order } from "@/lib/orders";

export const dynamic = "force-dynamic";

// الجزائر: UTC+1 طول العام
function dzDayStart(daysAgo = 0) {
  const H = 3600_000, D = 24 * H;
  return new Date(Math.floor((Date.now() + H) / D) * D - H - daysAgo * D);
}

export async function GET() {
  const g = await guard(); if (g) return g;
  try {
    const since = dzDayStart(29).toISOString();
    const rows = await dbSelect<Pick<Order, "created_at" | "total" | "status">>("orders",
      { select: "created_at,total,status", gte: { created_at: since }, limit: 10000 }, { fresh: true });
    const latest = await dbSelect<Order>("orders", { order: ["created_at", "desc"], limit: 5 }, { fresh: true });
    const valid = (o: { status: string }) => o.status !== "cancelled" && o.status !== "returned";
    const sum = (from: Date) => {
      const r = rows.filter((o) => new Date(o.created_at) >= from);
      return { count: r.length, revenue: r.filter(valid).reduce((s, o) => s + o.total, 0) };
    };
    const delivered = rows.filter((o) => o.status === "delivered").length;
    const closed = rows.filter((o) => ["delivered", "returned"].includes(o.status)).length;
    return NextResponse.json({
      today: sum(dzDayStart(0)),
      week: sum(dzDayStart(6)),
      month: sum(dzDayStart(29)),
      pending: rows.filter((o) => o.status === "new").length,
      deliveryRate: closed ? Math.round((delivered / closed) * 100) : null,
      latest,
    });
  } catch (e) { return fail(e); }
}
