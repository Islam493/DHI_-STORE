import { after } from "next/server";
import { dbInsert, dbUpdate } from "./db";

export * from "./order-types";
import { groups, type Order, type Status } from "./order-types";
import { adjustStock } from "./stock";

// الخانات الجديدة: إذا مازال ما تزادوش فـ Supabase، نحفظو بلاهم (باش ما تضيعش حتى طلبية)
const OPTIONAL = ["history", "updated_at", "tracking", "shipped_at", "internal_note", "stock_applied"] as const;
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

// الحالات اللي ترجّع السلعة للمخزون
const RELEASE: Status[] = [...groups.cancelled, "returned"];

// تعديل طلبية + تسجيل الحالة فالتاريخ (شكون ووقتاش) + تصحيح المخزون
export async function updateOrder(cur: Order, patch: Partial<Order>, by = "؟") {
  const at = new Date().toISOString();
  const p: Record<string, unknown> = { ...patch, updated_at: at };
  if (patch.status && patch.status !== cur.status) {
    p.history = [...(cur.history || []), { s: patch.status as Status, at, by }];
    const toRelease = RELEASE.includes(patch.status as Status);
    if (toRelease && cur.stock_applied) {
      const r = await adjustStock(cur.product_id, cur.quantity, patch.status === "returned" ? "return" : "cancel", cur.id, by);
      if (r.tracked) p.stock_applied = false;
    } else if (!toRelease && RELEASE.includes(cur.status as Status) && !cur.stock_applied) {
      const r = await adjustStock(cur.product_id, -cur.quantity, "reactivate", cur.id, by);
      if (r.tracked && !r.ok) throw new Error(`المخزون ما يكفيش (باقي ${r.stock})`);
      if (r.tracked) p.stock_applied = true;
    }
  }
  try {
    await dbUpdate("orders", { id: cur.id }, p);
  } catch (e) {
    if (!missingColumn(e)) throw e;
    await dbUpdate("orders", { id: cur.id }, strip(p));
  }
  // فيسبوك (Conversions API): الطلبية تأكدت ولا وصلت ← نخبروه من بعد (ما نعطلوش الفريق)
  if (patch.status && patch.status !== cur.status) {
    const o = { ...cur, ...patch } as Order, s = patch.status;
    const job = () => import("./capi").then((m) => m.capiStatus(o, s)).catch((e) => console.error("capi:", e));
    try { after(job); } catch { void job(); }
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
