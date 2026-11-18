import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { dbPage, dbSelect } from "@/lib/db";
import { orderCounts } from "@/lib/stats";
import { parseFilters, toQuery } from "@/lib/order-query";
import { getAllProducts } from "@/lib/catalog";
import { updateOrder, type Order } from "@/lib/orders";
import { isStatus } from "@/lib/order-types";
import { actor, fail, guard } from "@/lib/admin-api";
import { carrier } from "@/lib/ecotrack";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guard("orders.view"); if (g) return g;
  const u = new URL(req.url);
  const f = parseFilters(u.searchParams);
  const per = [25, 50, 100].includes(Number(u.searchParams.get("per"))) ? Number(u.searchParams.get("per")) : 25;
  const page = Math.max(1, parseInt(u.searchParams.get("page") || "1") || 1);
  try {
    // التقسيم على صفحات من السيرفر: ما نجيبوش آلاف الطلبيات للمتصفح
    const [{ rows, total }, counts, products] = await Promise.all([
      dbPage<Order>("orders", { ...toQuery(f), limit: per, offset: (page - 1) * per }),
      orderCounts(),
      getAllProducts(true),
    ]);
    const images = Object.fromEntries(products.map((p) => [p.id, p.images[0] || ""]));
    return NextResponse.json({
      orders: rows.map((o) => ({ ...o, image: images[o.product_id] || null })),
      total, page, per, counts, carrier: carrier.enabled,
      products: products.map((p) => ({ id: p.id, name: p.name })),
    });
  } catch (e) { return fail(e); }
}

export async function PATCH(req: Request) {
  const g = await guard("orders.edit"); if (g) return g;
  const { id, ids, status } = await req.json().catch(() => ({}));
  const list: string[] = Array.isArray(ids) ? ids.filter((x: unknown) => typeof x === "string").slice(0, 200) : typeof id === "string" ? [id] : [];
  if (!list.length || !isStatus(status)) return NextResponse.json({ error: "معلومات غالطة" }, { status: 400 });
  try {
    const by = await actor();
    const errors: string[] = [];
    for (const oid of list) {
      const [o] = await dbSelect<Order>("orders", { eq: { id: oid }, limit: 1 }, { fresh: true });
      if (!o || o.status === status) continue;
      try { await updateOrder(o, { status }, by); } catch (e) { errors.push(`#${oid}: ${(e as Error).message}`); }
    }
    await audit(by, "order.status", list.join(","), { status, count: list.length });
    return NextResponse.json({ ok: true, errors });
  } catch (e) { return fail(e); }
}
