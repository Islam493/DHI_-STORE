import { NextResponse } from "next/server";
import { dbSelect, dbUpsert } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { groups, type Order, type Status } from "@/lib/order-types";
import { actor, fail, guard } from "@/lib/admin-api";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ phone: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const g = await guard("customers.view"); if (g) return g;
  const phone = decodeURIComponent((await params).phone).replace(/\D/g, "").slice(0, 10);
  try {
    const orders = await dbSelect<Order>("orders", { eq: { phone }, order: ["created_at", "desc"], limit: 200 }, { fresh: true });
    if (!orders.length) return NextResponse.json({ error: "الزبون ما كانش" }, { status: 404 });
    let note = "";
    try { note = (await dbSelect<{ note: string }>("customers", { eq: { phone }, limit: 1 }, { fresh: true }))[0]?.note || ""; } catch {}
    const s = await getSettings(true);
    const last = orders[0];
    return NextResponse.json({
      customer: {
        phone, name: last.customer_name, wilaya: `${last.wilaya_code} - ${last.wilaya_name}`, commune: last.commune, address: last.address,
        orders: orders.length,
        delivered: orders.filter((o) => o.status === "delivered").length,
        cancelled: orders.filter((o) => groups.cancelled.includes(o.status as Status)).length,
        returned: orders.filter((o) => o.status === "returned").length,
        spent: orders.filter((o) => o.status === "delivered").reduce((a, o) => a + o.total, 0),
        first: orders[orders.length - 1].created_at, last: last.created_at,
        blocked: s.blocked.phones.includes(phone),
      },
      note, orders,
    });
  } catch (e) { return fail(e); }
}

export async function PUT(req: Request, { params }: Ctx) {
  const g = await guard("customers.edit"); if (g) return g;
  const phone = decodeURIComponent((await params).phone).replace(/\D/g, "").slice(0, 10);
  const { note } = await req.json().catch(() => ({ note: "" }));
  try {
    await dbUpsert("customers", { phone, note: String(note || "").slice(0, 2000), updated_at: new Date().toISOString() }, "phone");
    await audit(await actor(), "customer.note", phone);
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
