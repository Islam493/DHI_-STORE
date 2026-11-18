import { dbInsert, dbUpdate } from "./db";

export * from "./order-types";
import type { Order, Status } from "./order-types";

// يحفظ الطلبية: فـ Supabase إذا كان مربوط، وإلا فملف محلي (للتجربة على الكمبيوتر برك)
// الخانات الجديدة: إذا مازال ما تزادوش فـ Supabase، نحفظو بلاهم (باش ما تضيعش حتى طلبية)
const OPTIONAL = ["history", "updated_at", "tracking", "shipped_at"] as const;
const missingColumn = (e: unknown) => /PGRST204|column|schema cache/i.test(String(e));
function strip<T extends Record<string, unknown>>(o: T) {
  const c = { ...o };
  for (const k of OPTIONAL) delete c[k];
  return c;
}

export async function saveOrder(order: Order) {
  const row = { ...order, history: [{ s: "new", at: order.created_at }] };
  try {
    await dbInsert("orders", row);
  } catch (e) {
    if (!missingColumn(e)) throw e;
    await dbInsert("orders", strip(row));
  }
}

// تعديل طلبية + تسجيل الحالة الجديدة فالتاريخ
export async function updateOrder(cur: Order, patch: Partial<Order>) {
  const at = new Date().toISOString();
  const p: Record<string, unknown> = { ...patch, updated_at: at };
  if (patch.status && patch.status !== cur.status) {
    p.history = [...(cur.history || []), { s: patch.status as Status, at }];
  }
  try {
    await dbUpdate("orders", { id: cur.id }, p);
  } catch (e) {
    if (!missingColumn(e)) throw e;
    await dbUpdate("orders", { id: cur.id }, strip(p));
  }
}

// إشعار تيليغرام فوري كي تجي طلبية
export async function notifyTelegram(o: Order) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  const text = [
    `🛒 طلبية جديدة #${o.id}`,
    `📦 ${o.product_name}${o.variant ? ` (${o.variant})` : ""} × ${o.quantity}`,
    `👤 ${o.customer_name}`,
    `📞 ${o.phone}`,
    `📍 ${o.wilaya_code} - ${o.wilaya_name} / ${o.commune}`,
    `🚚 ${o.delivery_method === "home" ? "للدار" : "للمكتب"}${o.address ? ` — ${o.address}` : ""}`,
    `💰 المجموع: ${o.total} دج (توصيل ${o.shipping_fee})`,
    o.note ? `📝 ${o.note}` : "",
  ].filter(Boolean).join("\n");
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text }),
    });
  } catch (e) {
    console.error("telegram notify failed", e);
  }
}
