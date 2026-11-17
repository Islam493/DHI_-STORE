import { promises as fs } from "fs";
import path from "path";

export type Order = {
  id: string;
  created_at: string;
  status: "new";
  customer_name: string;
  phone: string;
  wilaya_code: number;
  wilaya_name: string;
  commune: string;
  address: string;
  delivery_method: "home" | "desk";
  product_id: string;
  product_name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
  shipping_fee: number;
  total: number;
  note: string;
  ip: string | null;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// يحفظ الطلبية: فـ Supabase إذا كان مربوط، وإلا فملف محلي (للتجربة على الكمبيوتر برك)
export async function saveOrder(order: Order) {
  if (SUPABASE_URL && SUPABASE_KEY) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(order),
    });
    if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
    return;
  }
  if (process.env.NODE_ENV === "production" && process.env.VERCEL) {
    throw new Error("Supabase is not configured");
  }
  const file = path.join(process.cwd(), "data", "orders.local.json");
  await fs.mkdir(path.dirname(file), { recursive: true });
  let list: Order[] = [];
  try {
    list = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {}
  list.unshift(order);
  await fs.writeFile(file, JSON.stringify(list, null, 2));
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
