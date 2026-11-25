import { NextResponse, after } from "next/server";
import { dbSelect } from "@/lib/db";
import { orderCounts } from "@/lib/stats";
import { openCount } from "@/lib/abandoned";
import { maybeTick } from "@/lib/automation";
import { fail, guard } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

// التنبيهات: طلبيات جديدة + مخزون قليل ولا نافذ
export async function GET() {
  const g = await guard("orders.view"); if (g) return g;
  try {
    const [counts, abandoned, last] = await Promise.all([
      orderCounts(), openCount(),
      dbSelect<{ id: string; created_at: string; customer_name: string; product_name: string; total: number; wilaya_name: string }>(
        "orders", { select: "id,created_at,customer_name,product_name,total,wilaya_name", order: ["created_at", "desc"], limit: 1 }, { fresh: true }).catch(() => []),
    ]);
    after(maybeTick); // اللوحة محلولة: نخدمو التذكير والتتبع
    let lowStock: { id: string; name: string; stock: number }[] = [];
    try {
      const rows = await dbSelect<{ id: string; name: string; stock: number; low_stock: number | null; active: boolean }>(
        "products", { select: "id,name,stock,low_stock,active", notNull: ["stock"], limit: 500 }, { fresh: true });
      lowStock = rows.filter((p) => p.active && p.stock <= (p.low_stock ?? 3)).sort((a, b) => a.stock - b.stock).map(({ id, name, stock }) => ({ id, name, stock }));
    } catch { /* خانة المخزون مازال ما تزادتش */ }
    return NextResponse.json({ newOrders: counts.new || 0, abandoned, lowStock, latest: last[0] || null });
  } catch (e) { return fail(e); }
}
