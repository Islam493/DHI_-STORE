import { dbSelectAll } from "@/lib/db";
import { audit } from "@/lib/audit";
import { actor, fail, guard } from "@/lib/admin-api";
import { parseFilters, toQuery } from "@/lib/order-query";
import { statuses, type Order, type Status } from "@/lib/order-types";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// تصدير CSV يتحل فـ Excel بالعربية (UTF-8 BOM)
export async function GET(req: Request) {
  const g = await guard("orders.export"); if (g) return g;
  try {
    const f = parseFilters(new URL(req.url).searchParams);
    const q = toQuery(f);
    const rows = await dbSelectAll<Order>("orders", { ...q, order: q.order });
    const head = ["رقم الطلبية", "التاريخ", "الحالة", "الاسم", "الهاتف", "رقم الولاية", "الولاية", "البلدية", "العنوان", "التوصيل", "المنتج", "النوع", "الكمية", "سعر الوحدة", "سعر التوصيل", "المجموع", "رقم التتبع", "ملاحظة الزبون", "ملاحظة داخلية"];
    const lines = rows.map((o) => [
      o.id, new Date(o.created_at).toLocaleString("fr-DZ", { timeZone: "Africa/Algiers" }), statuses[o.status as Status]?.label || o.status,
      o.customer_name, o.phone, o.wilaya_code, o.wilaya_name, o.commune, o.address, o.delivery_method === "desk" ? "مكتب" : "دار",
      o.product_name, o.variant, o.quantity, o.unit_price, o.shipping_fee, o.total, o.tracking, o.note, o.internal_note,
    ].map(esc).join(","));
    await audit(await actor(), "orders.export", null, { count: rows.length, filters: { ...f, ids: f.ids.length } });
    const csv = "﻿" + [head.join(","), ...lines].join("\r\n");
    const name = `dhi-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` } });
  } catch (e) { return fail(e); }
}
