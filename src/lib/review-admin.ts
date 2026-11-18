import { dbSelect } from "./db";
import type { Order } from "./order-types";

// "شراء مؤكد" غير إذا الطلبية كاينة وتسلّمت (مكتملة)
export async function verifyOrder(orderId: string | null, productId: string | null) {
  if (!orderId) return false;
  const [o] = await dbSelect<Order>("orders", { eq: { id: orderId }, limit: 1 }, { fresh: true });
  return Boolean(o && o.status === "delivered" && (!productId || o.product_id === productId));
}

export function clean(b: Record<string, unknown>) {
  const rating = Math.round(Number(b.rating));
  const r = {
    product_id: typeof b.product_id === "string" && b.product_id ? b.product_id.slice(0, 60) : null,
    name: String(b.name || "").trim().slice(0, 60),
    wilaya: String(b.wilaya || "").trim().slice(0, 40),
    rating: rating >= 1 && rating <= 5 ? rating : 5,
    text: String(b.text || "").trim().slice(0, 1500),
    image: typeof b.image === "string" && /^(\/|https:\/\/)/.test(b.image) ? b.image.slice(0, 500) : null,
    order_id: typeof b.order_id === "string" && b.order_id.trim() ? b.order_id.trim().replace(/^#/, "").slice(0, 30) : null,
    visible: b.visible !== false,
  };
  if (r.name.length < 2) return { error: "اكتب اسم الزبون" };
  if (r.text.length < 3 && !r.image) return { error: "اكتب الرأي ولا زيد سكرين" };
  return { review: r };
}

