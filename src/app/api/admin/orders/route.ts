import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { dbDelete, dbPage, dbSelect } from "@/lib/db";
import { orderCounts } from "@/lib/stats";
import { parseFilters, toQuery } from "@/lib/order-query";
import { getAllProducts } from "@/lib/catalog";
import { updateOrder, type Order } from "@/lib/orders";
import { isStatus } from "@/lib/order-types";
import { actor, fail, guard } from "@/lib/admin-api";
import { carrier } from "@/lib/ecotrack";
import { phoneInsights } from "@/lib/abandoned";

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
    // تاريخ كل زبون (استلم / رجّع / مزيف) والطلبيات المكررة: باش تعرف شكون تأكد قبل ما تبعث
    const { history, dups } = await phoneInsights(rows.map((o) => o.phone)).catch(() => ({ history: {}, dups: {} as Record<string, string> }));
    return NextResponse.json({
      history, dups,
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

// حذف نهائي (المدير برك) — نرجعو المخزون قبل
export async function DELETE(req: Request) {
  const g = await guard("orders.delete"); if (g) return g;
  const { ids } = await req.json().catch(() => ({}));
  const list: string[] = Array.isArray(ids) ? ids.filter((x: unknown) => typeof x === "string").slice(0, 500) : [];
  if (!list.length) return NextResponse.json({ error: "ما اخترت حتى طلبية" }, { status: 400 });
  try {
    const by = await actor();
    let deleted = 0;
    for (const id of list) {
      const [o] = await dbSelect<Order>("orders", { eq: { id }, limit: 1 }, { fresh: true });
      if (!o) continue;
      if (o.stock_applied && !["cancelled", "cancelled_client", "fake", "duplicate", "returned"].includes(o.status)) {
        await updateOrder(o, { status: "cancelled" }, by).catch(() => {});
      }
      await dbDelete("orders", { id });
      deleted++;
    }
    await audit(by, "order.delete", list.join(","), { count: deleted });
    return NextResponse.json({ ok: true, deleted });
  } catch (e) { return fail(e); }
}
