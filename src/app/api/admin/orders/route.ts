import { NextResponse } from "next/server";
import { dbSelect, dbUpdate } from "@/lib/db";
import { statuses, type Order } from "@/lib/orders";
import { fail, guard } from "@/lib/admin-api";

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
    return NextResponse.json({ orders, counts });
  } catch (e) { return fail(e); }
}

export async function PATCH(req: Request) {
  const g = await guard(); if (g) return g;
  const { id, status } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || !(status in statuses)) return NextResponse.json({ error: "معلومات غالطة" }, { status: 400 });
  try {
    await dbUpdate("orders", { id }, { status });
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
