import { dbInsert } from "./db";

export * from "./order-types";
import type { Order } from "./order-types";

// يحفظ الطلبية: فـ Supabase إذا كان مربوط، وإلا فملف محلي (للتجربة على الكمبيوتر برك)
export async function saveOrder(order: Order) {
  await dbInsert("orders", order);
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
