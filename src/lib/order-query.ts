// تحويل فلاتر الطلبيات (من الرابط) لاستعلام قاعدة البيانات — نفس المنطق للعرض وللتصدير
import type { Query } from "./db";
import { groups, isStatus, type Status } from "./order-types";

export type OrderFilters = { status: string; q: string; from: string; to: string; wilaya: number | null; product: string; sort: string; ids: string[] };

const day = /^\d{4}-\d{2}-\d{2}$/;

export function parseFilters(sp: URLSearchParams): OrderFilters {
  const w = Number(sp.get("wilaya"));
  return {
    status: sp.get("status") || "",
    q: (sp.get("q") || "").trim().slice(0, 50),
    from: day.test(sp.get("from") || "") ? sp.get("from")! : "",
    to: day.test(sp.get("to") || "") ? sp.get("to")! : "",
    wilaya: w >= 1 && w <= 58 ? w : null,
    product: (sp.get("product") || "").slice(0, 60),
    sort: sp.get("sort") || "new",
    ids: (sp.get("ids") || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 500),
  };
}

// توقيت الجزائر UTC+1
const startOf = (d: string) => `${d}T00:00:00+01:00`;
const nextDay = (d: string) => new Date(new Date(`${d}T00:00:00+01:00`).getTime() + 86400_000).toISOString();

const sorts: Record<string, [string, "asc" | "desc"]> = {
  new: ["created_at", "desc"], old: ["created_at", "asc"], total_desc: ["total", "desc"], total_asc: ["total", "asc"],
};

export function toQuery(f: OrderFilters): Query {
  const q: Query = { eq: {}, in: {}, order: sorts[f.sort] || sorts.new };
  if (f.ids.length) q.in!.id = f.ids;
  if (f.status === "pending") q.in!.status = groups.pending;
  else if (f.status === "confirmed_all") q.in!.status = groups.confirmed;
  else if (f.status === "cancelled_all") q.in!.status = groups.cancelled;
  else if (isStatus(f.status)) q.eq!.status = f.status as Status;
  if (f.wilaya) q.eq!.wilaya_code = f.wilaya;
  if (f.product) q.eq!.product_id = f.product;
  if (f.from) q.gte = { created_at: startOf(f.from) };
  if (f.to) q.lt = { created_at: nextDay(f.to) };
  if (f.q) q.search = { cols: ["customer_name", "phone", "id", "commune", "wilaya_name", "tracking", "address"], term: f.q };
  return q;
}
