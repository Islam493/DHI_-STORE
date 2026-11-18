import { dbSelectAll } from "@/lib/db";
import { audit } from "@/lib/audit";
import { actor, fail, guard } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

// نسخة احتياطية كاملة (JSON): الطلبيات، المنتجات، الإعدادات، الآراء، المخزون، ملاحظات الزبائن
export async function GET() {
  const g = await guard("settings.edit"); if (g) return g;
  try {
    const safe = async (t: string) => { try { return await dbSelectAll(t); } catch { return []; } };
    const [orders, products, settings, reviews, stock_movements, customers] = await Promise.all(
      ["orders", "products", "settings", "reviews", "stock_movements", "customers"].map(safe));
    await audit(await actor(), "backup", null, { orders: orders.length, products: products.length });
    const body = JSON.stringify({ app: "dhi-store", at: new Date().toISOString(), orders, products, settings, reviews, stock_movements, customers });
    return new Response(body, { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="dhi-backup-${new Date().toISOString().slice(0, 10)}.json"` } });
  } catch (e) { return fail(e); }
}
