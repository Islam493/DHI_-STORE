import { NextResponse } from "next/server";
import { dbSelect } from "@/lib/db";
import { getAllProducts } from "@/lib/catalog";
import { statuses, updateOrder, type Order } from "@/lib/orders";
import { isStatus } from "@/lib/order-types";
import { fail, guard } from "@/lib/admin-api";
import { carrier } from "@/lib/ecotrack";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guard(); if (g) return g;
  const u = new URL(req.url);
  const status = u.searchParams.get("status") || "";
  const q = (u.searchParams.get("q") || "").trim().slice(0, 50);
  const offset = Math.max(0, parseInt(u.searchParams.get("offset") || "0") || 0);
  try {
    const orders = await dbSelect<Order>("orders", {
      eq: status && status in statuses ? { status } : undefined,
      search: q ? { cols: ["customer_name", "phone", "id", "commune", "wilaya_name"], term: q } : undefined,
      order: ["created_at", "desc"], limit: 50, offset,
    }, { fresh: true });
    // عدد الطلبيات فكل حالة (للأزرار)
    const all = await dbSelect<{ status: string }>("orders", { select: "status", limit: 5000 }, { fresh: true });
    const counts: Record<string, number> = { all: all.length };
    for (const o of all) counts[o.status] = (counts[o.status] || 0) + 1;
    const products = await getAllProducts(true);
    const images = Object.fromEntries(products.map((p) => [p.id, p.images[0] || ""]));
    return NextResponse.json({ orders: orders.map((o) => ({ ...o, image: images[o.product_id] || null })), counts, carrier: carrier.enabled });
  } catch (e) { return fail(e); }
}

export async function PATCH(req: Request) {
  const g = await guard(); if (g) return g;
  const { id, ids, status } = await req.json().catch(() => ({}));
  const list: string[] = Array.isArray(ids) ? ids.filter((x: unknown) => typeof x === "string").slice(0, 200) : typeof id === "string" ? [id] : [];
  if (!list.length || !isStatus(status)) return NextResponse.json({ error: "معلومات غالطة" }, { status: 400 });
  try {
    for (const oid of list) {
      const [o] = await dbSelect<Order>("orders", { eq: { id: oid }, limit: 1 }, { fresh: true });
      if (o && o.status !== status) await updateOrder(o, { status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
