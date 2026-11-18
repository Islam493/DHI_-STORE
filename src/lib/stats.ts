// الإحصائيات: تتحسب فقاعدة البيانات (سريعة). إذا الدوال مازال ما تنحّاتش: نحسبو هنا
import { dbRpc, dbSelectAll } from "./db";
import { groups, type Status } from "./order-types";

type O = { created_at: string; status: string; total: number; unit_price: number; quantity: number; product_id: string; product_name: string; wilaya_code: number; wilaya_name: string };
export type Day = { day: string; orders: number; confirmed: number; delivered: number; returned: number; cancelled: number; gross: number; delivered_revenue: number; delivered_product_revenue: number; delivered_cost: number; delivered_missing_cost: number };
export type ProductPerf = { product_id: string; product_name: string; orders: number; units: number; confirmed: number; delivered: number; returned: number; cancelled: number; delivered_revenue: number };
export type WilayaPerf = { wilaya_code: number; wilaya_name: string; orders: number; shipped: number; delivered: number; returned: number; cancelled: number };

const num = <T extends Record<string, unknown>>(r: T) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "string" && /^-?\d+$/.test(v) ? Number(v) : v])) as T;
const isC = (s: string) => groups.confirmed.includes(s as Status);
const isX = (s: string) => groups.cancelled.includes(s as Status);
const H = 3600_000;
export const dzDate = (iso: string | number) => new Date(new Date(iso).getTime() + H).toISOString().slice(0, 10);

async function rows(from: string, to: string, product?: string | null) {
  return dbSelectAll<O>("orders", {
    select: "created_at,status,total,unit_price,quantity,product_id,product_name,wilaya_code,wilaya_name",
    gte: { created_at: from }, lt: { created_at: to }, ...(product ? { eq: { product_id: product } } : {}),
  });
}

export async function orderCounts(): Promise<Record<string, number>> {
  const r = await dbRpc<{ status: string; n: number }[]>("dhi_order_counts");
  const list = r ?? (await dbSelectAll<{ status: string }>("orders", { select: "status" })).map((o) => ({ status: o.status, n: 1 }));
  const out: Record<string, number> = { all: 0 };
  for (const x of list) { out[x.status] = (out[x.status] || 0) + Number(x.n); out.all += Number(x.n); }
  return out;
}

export async function daily(from: string, to: string, product?: string | null, costs: Record<string, number | null> = {}): Promise<Day[]> {
  const r = await dbRpc<Day[]>("dhi_daily", { p_from: from, p_to: to, p_product: product || null });
  if (r) return r.map((d) => num({ ...d, day: String(d.day).slice(0, 10) }));
  const map = new Map<string, Day>();
  for (const o of await rows(from, to, product)) {
    const k = dzDate(o.created_at);
    const d = map.get(k) || { day: k, orders: 0, confirmed: 0, delivered: 0, returned: 0, cancelled: 0, gross: 0, delivered_revenue: 0, delivered_product_revenue: 0, delivered_cost: 0, delivered_missing_cost: 0 };
    d.orders++;
    if (isC(o.status)) d.confirmed++;
    if (o.status === "delivered") {
      d.delivered++; d.delivered_revenue += o.total; d.delivered_product_revenue += o.unit_price * o.quantity;
      const c = costs[o.product_id];
      if (c == null) d.delivered_missing_cost++; else d.delivered_cost += c * o.quantity;
    }
    if (o.status === "returned") d.returned++;
    if (isX(o.status)) d.cancelled++; else d.gross += o.total;
    map.set(k, d);
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export async function productsPerf(from: string, to: string): Promise<ProductPerf[]> {
  const r = await dbRpc<ProductPerf[]>("dhi_products", { p_from: from, p_to: to });
  if (r) return r.map(num);
  const map = new Map<string, ProductPerf>();
  for (const o of await rows(from, to)) {
    const p = map.get(o.product_id) || { product_id: o.product_id, product_name: o.product_name, orders: 0, units: 0, confirmed: 0, delivered: 0, returned: 0, cancelled: 0, delivered_revenue: 0 };
    p.orders++; p.units += o.quantity;
    if (isC(o.status)) p.confirmed++;
    if (o.status === "delivered") { p.delivered++; p.delivered_revenue += o.total; }
    if (o.status === "returned") p.returned++;
    if (isX(o.status)) p.cancelled++;
    map.set(o.product_id, p);
  }
  return [...map.values()].sort((a, b) => b.orders - a.orders);
}

export async function wilayasPerf(from: string, to: string): Promise<WilayaPerf[]> {
  const r = await dbRpc<WilayaPerf[]>("dhi_wilayas", { p_from: from, p_to: to });
  if (r) return r.map(num);
  const map = new Map<number, WilayaPerf>();
  for (const o of await rows(from, to)) {
    const w = map.get(o.wilaya_code) || { wilaya_code: o.wilaya_code, wilaya_name: o.wilaya_name, orders: 0, shipped: 0, delivered: 0, returned: 0, cancelled: 0 };
    w.orders++;
    if (["shipped", "delivered", "returned"].includes(o.status)) w.shipped++;
    if (o.status === "delivered") w.delivered++;
    if (o.status === "returned") w.returned++;
    if (isX(o.status)) w.cancelled++;
    map.set(o.wilaya_code, w);
  }
  return [...map.values()].sort((a, b) => b.orders - a.orders);
}

// بداية اليوم بتوقيت الجزائر (UTC+1)
export function dzDayStart(daysAgo = 0) {
  const D = 24 * H;
  return new Date(Math.floor((Date.now() + H) / D) * D - H - daysAgo * D);
}
