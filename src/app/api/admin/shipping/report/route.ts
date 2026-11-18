import { NextResponse } from "next/server";
import { dbPage } from "@/lib/db";
import { dzDayStart, orderCounts, wilayasPerf } from "@/lib/stats";
import type { Order } from "@/lib/order-types";
import { fail, guard } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

// تقرير التوصيل: الطرود (برقم التتبع)، والأداء حسب الولاية (آخر 90 يوم)
export async function GET(req: Request) {
  const g = await guard("orders.ship"); if (g) return g;
  const u = new URL(req.url);
  const page = Math.max(1, parseInt(u.searchParams.get("page") || "1") || 1);
  const status = ["shipped", "delivered", "returned"].includes(u.searchParams.get("status") || "") ? u.searchParams.get("status")! : "";
  try {
    const [ships, counts, wil] = await Promise.all([
      dbPage<Order>("orders", {
        select: "id,created_at,shipped_at,status,customer_name,phone,wilaya_code,wilaya_name,total,tracking",
        notNull: ["tracking"], ...(status ? { eq: { status } } : {}), order: ["shipped_at", "desc"], limit: 25, offset: (page - 1) * 25,
      }).catch(() => ({ rows: [] as Order[], total: 0 })),
      orderCounts(),
      wilayasPerf(dzDayStart(89).toISOString(), new Date(Date.now() + 86400_000).toISOString()),
    ]);
    return NextResponse.json({ shipments: ships.rows, total: ships.total, page, counts: { shipped: counts.shipped || 0, delivered: counts.delivered || 0, returned: counts.returned || 0 }, wilayas: wil });
  } catch (e) { return fail(e); }
}
