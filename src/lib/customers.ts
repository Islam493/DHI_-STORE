// الزبائن: ملخص من الطلبيات (view فقاعدة البيانات، ولا حساب هنا إذا مازال ما تنحّاتش)
import { dbPage, dbSelectAll, hasSupabase } from "./db";
import { groups, type Order, type Status } from "./order-types";

export type Customer = {
  phone: string; name: string; wilaya_code: number; wilaya_name: string; address: string;
  orders: number; delivered: number; cancelled: number; returned: number; spent: number; last_order: string; first_order: string;
};

const sorts: Record<string, [keyof Customer, "asc" | "desc"]> = {
  recent: ["last_order", "desc"], orders: ["orders", "desc"], spent: ["spent", "desc"], returned: ["returned", "desc"],
};

function aggregate(orders: Order[]): Customer[] {
  const map = new Map<string, Customer>();
  for (const o of [...orders].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const c = map.get(o.phone) || { phone: o.phone, name: "", wilaya_code: 0, wilaya_name: "", address: "", orders: 0, delivered: 0, cancelled: 0, returned: 0, spent: 0, last_order: o.created_at, first_order: o.created_at };
    c.name = o.customer_name; c.wilaya_code = o.wilaya_code; c.wilaya_name = o.wilaya_name; c.address = o.address; c.last_order = o.created_at;
    c.orders++;
    if (o.status === "delivered") { c.delivered++; c.spent += o.total; }
    if (o.status === "returned") c.returned++;
    if (groups.cancelled.includes(o.status as Status)) c.cancelled++;
    map.set(o.phone, c);
  }
  return [...map.values()];
}

export async function listCustomers(opts: { q: string; sort: string; page: number; per: number; returning: boolean }) {
  const [col, dir] = sorts[opts.sort] || sorts.recent;
  if (hasSupabase) {
    try {
      return await dbPage<Customer>("dhi_customers", {
        order: [col, dir], limit: opts.per, offset: (opts.page - 1) * opts.per,
        ...(opts.returning ? { gte: { orders: 2 } } : {}),
        ...(opts.q ? { search: { cols: ["name", "phone", "wilaya_name"], term: opts.q } } : {}),
      });
    } catch { /* الـ view مازال ما تنحّاتش → نحسبو هنا */ }
  }
  let all = aggregate(await dbSelectAll<Order>("orders", { select: "phone,customer_name,wilaya_code,wilaya_name,address,status,total,created_at" }));
  if (opts.returning) all = all.filter((c) => c.orders >= 2);
  if (opts.q) { const t = opts.q.toLowerCase(); all = all.filter((c) => [c.name, c.phone, c.wilaya_name].some((v) => v.toLowerCase().includes(t))); }
  all.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === "desc" ? -1 : 1));
  return { rows: all.slice((opts.page - 1) * opts.per, opts.page * opts.per), total: all.length };
}
