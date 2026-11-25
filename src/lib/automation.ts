// الأتمتة: تأكيد الطلبية بالواتساب ← تذكير ← إرسال لشركة التوصيل ← تتبع حتى توصل للزبون
import { dbSelect, dbUpsert } from "./db";
import { getSettings } from "./settings";
import { groups, type Order, type Status } from "./order-types";
import { updateOrder } from "./orders";
import { formatPrice, store } from "./config";
import { logMessage, sendTemplate, sendText, toLocal, wa, type Incoming } from "./whatsapp";
import { carrier, trackingStatus } from "./ecotrack";
import { shipOrder } from "./shipping";
import { sendPush } from "./push";

type Flags = {
  confirm_at?: string; reminder_at?: string; replied_at?: string; no_answer_at?: string; hint_at?: string;
  shipped_msg?: string; ofd_msg?: string; missed_msg?: string; delivered_msg?: string; return_alert?: string;
  // التأكيد اليدوي (من الواتساب العادي): المحاولات والرسائل اللي خرجت
  attempts?: { k: string; at: string; by?: string }[];
  sent?: Record<string, string>;
};
export type AutoState = { order_id: string; flags: Flags; carrier_status?: string | null; checked_at?: string | null };

const T = "order_automation";
const BOT = "🤖 واتساب";
const CARRIER_BOT = "🤖 World Express";
const now = () => new Date().toISOString();
const ago = (iso?: string | null) => (iso ? Date.now() - new Date(iso).getTime() : Infinity);

const first = (o: Order) => o.customer_name.trim().split(/\s+/)[0] || o.customer_name;
const productLabel = (o: Order) => `${o.product_name}${o.variant ? ` (${o.variant})` : ""}${o.quantity > 1 ? ` × ${o.quantity}` : ""}`;
const place = (o: Order) => `${o.wilaya_name}${o.commune ? ` — ${o.commune}` : ""} (${o.delivery_method === "desk" ? "المكتب" : "الدار"})`;

// ---------- الحالة لكل طلبية ----------
export async function getStates(ids: string[]) {
  const map: Record<string, AutoState> = {};
  if (!ids.length) return map;
  try {
    for (let i = 0; i < ids.length; i += 100) {
      const rows = await dbSelect<AutoState>(T, { in: { order_id: ids.slice(i, i + 100) }, limit: 100 }, { fresh: true });
      for (const r of rows) map[r.order_id] = { ...r, flags: r.flags || {} };
    }
  } catch { /* الجدول مازال ما تزادش */ }
  return map;
}
export async function getState(id: string): Promise<AutoState> {
  return (await getStates([id]))[id] || { order_id: id, flags: {} };
}
async function setState(id: string, patch: Partial<AutoState> = {}, flags?: Flags) {
  try {
    const merged = flags ? { ...(await getState(id)).flags, ...flags } : undefined;
    await dbUpsert(T, { order_id: id, ...patch, ...(merged ? { flags: merged } : {}), updated_at: now() }, "order_id");
  } catch (e) { console.error("automation state:", String(e).slice(0, 200)); }
}

// الفريق عيّط ولا بعث رسالة من الواتساب تاعو: نسجلو باش ما يعاودش ولا ينسى
export async function logContact(id: string, kind: string, by: string) {
  const st = await getState(id);
  const at = now();
  const attempts = [...(st.flags.attempts || []), { k: kind, at, by }].slice(-30);
  const flags: Flags = { attempts };
  if (kind !== "call") flags.sent = { ...(st.flags.sent || {}), [kind]: at };
  await setState(id, {}, flags);
  return { attempts, sent: flags.sent || st.flags.sent || {} };
}

async function loadOrder(id: string) {
  const [o] = await dbSelect<Order>("orders", { eq: { id }, limit: 1 }, { fresh: true });
  return o;
}

// إشعار للفريق: تطبيق اللوحة (Web Push) + تيليغرام (إذا مربوط)
export async function notifyStaff(text: string) {
  const [title, ...rest] = text.split("\n");
  await sendPush({ title: title.slice(0, 120), body: rest.join("\n").slice(0, 300) || "DHI Electronics", url: "/admin/follow" }).catch(() => {});
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chat, text }),
    });
  } catch (e) { console.error("telegram:", e); }
}

// ---------- 1) طلبية جديدة: رسالة التأكيد بالأزرار ----------
export async function onOrderCreated(o: Order) {
  if (!wa.enabled) return;
  const s = (await getSettings()).automation;
  if (!s.confirm) return;
  const id = await sendTemplate(o.phone, "dhi_confirm", [first(o), productLabel(o), formatPrice(o.total), place(o)], {
    orderId: o.id, payloads: [`CONFIRM:${o.id}`, `CANCEL:${o.id}`, `HELP:${o.id}`],
  });
  if (id) await setState(o.id, {}, { confirm_at: now() });
}

// ---------- 2) الزبون جاوب (زر ولا كتابة) ----------
export async function handleIncoming(m: Incoming) {
  const phone = toLocal(m.from);
  // واتساب يقدر يعاود يبعث نفس الرسالة: ما نعاودوش نخدموها
  try {
    if (m.id && (await dbSelect("wa_messages", { eq: { wa_id: m.id }, limit: 1, select: "id" }, { fresh: true })).length) return;
  } catch { /* الجدول ما كانش */ }

  const [action, orderId] = (m.payload || "").split(":");
  let o = orderId ? await loadOrder(orderId) : undefined;
  if (o && o.phone !== phone) o = undefined; // ما يقدرش يأكد طلبية تاع واحد آخر
  if (!o && !m.payload) {
    const mine = await dbSelect<Order>("orders", { eq: { phone }, order: ["created_at", "desc"], limit: 1 }, { fresh: true });
    o = mine[0];
  }
  await logMessage({ order_id: o?.id ?? null, phone, dir: "in", kind: m.payload ? "button" : "text", body: m.text, wa_id: m.id, status: "received" });
  const s = (await getSettings()).automation;

  if (action === "TEST") {
    await sendText(phone, "✅ التجربة نجحت! الأزرار يخدمو والرسائل يوصلو للمتجر.", null, "auto_reply").catch(() => {});
    return;
  }
  if (o && action === "HELP") {
    await sendText(phone, "أكيد 🙏 اكتبلنا سؤالك هنا، وواحد من الفريق يجاوبك فأقرب وقت.", o.id, "auto_reply").catch(() => {});
    await notifyStaff(`❓ عندو سؤال قبل ما يأكد: #${o.id} — ${o.customer_name} (${o.phone}) — ${o.product_name}\nجاوبو من اللوحة: ${store.url}/admin/orders/${o.id}`);
    return;
  }
  if (o && action === "CALLME") {
    await sendText(phone, "مليح 👍 نعيطولك فأقرب وقت باش نبرمجو التوصيل.", o.id, "auto_reply").catch(() => {});
    await notifyStaff(`📞 حاب تعيطولو (الليفرور ما لقاهش): #${o.id} — ${o.customer_name} (${o.phone})`);
    return;
  }
  if (o && action === "CONFIRM") {
    if (groups.pending.includes(o.status as Status)) {
      await updateOrder(o, { status: "confirmed" }, BOT);
      await setState(o.id, {}, { replied_at: now() });
      await sendText(phone, `✅ شكراً ${first(o)}! طلبيتك #${o.id} تأكدت.\nنحضّروها ونبعثوهالك فأقرب وقت، ونبعثولك رقم التتبع هنا 🚚`, o.id, "auto_reply").catch(() => {});
      await notifyStaff(`✅ أكّد بالواتساب: #${o.id} — ${o.customer_name} — ${o.product_name}`);
      if (s.autoShip && carrier.enabled && o.commune) {
        const fresh = await loadOrder(o.id);
        try {
          if (fresh && !fresh.tracking) { const r = await shipOrder(fresh, {}, BOT); await onShipped(r.order); }
        } catch (e) {
          await notifyStaff(`⚠️ ما قدرناش نبعثو #${o.id} لـ World Express وحدها: ${(e as Error).message}\nابعثها من اللوحة.`);
        }
      }
    } else if (!groups.cancelled.includes(o.status as Status)) {
      await sendText(phone, `طلبيتك #${o.id} مأكدة ديجا ✅ شكراً!`, o.id, "auto_reply").catch(() => {});
    }
    return;
  }
  if (o && action === "CANCEL") {
    if (groups.pending.includes(o.status as Status)) {
      await updateOrder(o, { status: "cancelled_client" }, BOT);
      await setState(o.id, {}, { replied_at: now() });
      await sendText(phone, `تلغات طلبيتك #${o.id}. إذا غلطت ولا بدّلت رأيك، ابعثلنا هنا ونعاودو نسجلوهالك 🙏`, o.id, "auto_reply").catch(() => {});
      await notifyStaff(`❌ ألغى بالواتساب: #${o.id} — ${o.customer_name} — ${o.product_name}`);
    } else if (["confirmed", "preparing", "ready", "shipped"].includes(o.status)) {
      await sendText(phone, `طلبيتك #${o.id} راهي فالطريق. باش تلغيها عيّطلنا ولا ابعثلنا هنا وواحد من الفريق يجاوبك.`, o.id, "auto_reply").catch(() => {});
      await notifyStaff(`⚠️ حاب يلغي طلبية خرجت: #${o.id} — ${o.customer_name} (${o.phone})`);
    }
    return;
  }

  // كتب رسالة: نخبرو الفريق، وإذا عندو طلبية تستنى التأكيد نفكروه بالزر (مرة وحدة)
  await notifyStaff(`💬 واتساب من ${phone}${o ? ` (#${o.id})` : ""}:\n${m.text}\n\nجاوبو من اللوحة: ${store.url}/admin/orders/${o?.id ?? ""}`);
  if (o && o.status === "new") {
    const st = await getState(o.id);
    if (st.flags.confirm_at && !st.flags.hint_at) {
      await sendText(phone, `شكراً على رسالتك 🙏 باش تأكد طلبيتك #${o.id} اضغط على الزر «✅ نأكد الطلبية» فالرسالة اللي فوق، وواحد من الفريق يجاوبك على سؤالك.`, o.id, "auto_reply").catch(() => {});
      await setState(o.id, {}, { hint_at: now() });
    }
  }
}

// ---------- 3) خرجت مع شركة التوصيل ----------
export async function onShipped(o: Order) {
  if (!wa.enabled || !o.tracking) return;
  const s = (await getSettings()).automation;
  if (!s.messages) return;
  const st = await getState(o.id);
  if (st.flags.shipped_msg) return;
  const id = await sendTemplate(o.phone, "dhi_shipped", [first(o), productLabel(o), o.tracking, formatPrice(o.total)], { orderId: o.id });
  if (id) await setState(o.id, {}, { shipped_msg: now() });
}

// ---------- 4) الدورة: تذكير، ما جاوبش، تتبع الطرود ----------
export type TickResult = { reminders: number; noAnswer: number; checked: number; delivered: number; outForDelivery: number; missed: number; returns: number; errors: string[] };

export async function tick(limit = 40): Promise<TickResult> {
  const r: TickResult = { reminders: 0, noAnswer: 0, checked: 0, delivered: 0, outForDelivery: 0, missed: 0, returns: 0, errors: [] };
  const s = (await getSettings(true)).automation;

  // تذكير بعد شوية سوايع، ومن بعد «لم يرد» باش الفريق يعيطلو
  if (wa.enabled && s.confirm) {
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const pending = await dbSelect<Order>("orders", { eq: { status: "new" }, gte: { created_at: since }, order: ["created_at", "asc"], limit: 300 }, { fresh: true });
    const states = await getStates(pending.map((o) => o.id));
    let n = 0;
    for (const o of pending) {
      if (n >= limit) break;
      const f = states[o.id]?.flags;
      if (!f?.confirm_at || f.replied_at || f.no_answer_at) continue;
      if (!f.reminder_at && ago(f.confirm_at) > s.reminderHours * 3600_000) {
        n++;
        const id = await sendTemplate(o.phone, "dhi_confirm_reminder", [first(o), productLabel(o)], { orderId: o.id, payloads: [`CONFIRM:${o.id}`, `CANCEL:${o.id}`, `HELP:${o.id}`] });
        if (id) { r.reminders++; await setState(o.id, {}, { reminder_at: now() }); }
      } else if (f.reminder_at && ago(f.confirm_at) > s.noAnswerHours * 3600_000) {
        n++;
        try {
          await updateOrder(o, { status: "no_answer" }, BOT);
          await setState(o.id, {}, { no_answer_at: now() });
          r.noAnswer++;
        } catch (e) { r.errors.push(`#${o.id}: ${(e as Error).message}`); }
      }
    }
  }

  // تتبع الطرود عند World Express
  if (s.tracking && carrier.enabled) {
    const shipped = await dbSelect<Order>("orders", { eq: { status: "shipped" }, notNull: ["tracking"], order: ["shipped_at", "asc"], limit: 300 }, { fresh: true });
    const states = await getStates(shipped.map((o) => o.id));
    const due = shipped.filter((o) => ago(states[o.id]?.checked_at) > 45 * 60_000).slice(0, limit);
    let failures = 0;
    for (const o of due) {
      const f = states[o.id]?.flags || {};
      try {
        const t = await trackingStatus(o.tracking!);
        failures = 0;
        r.checked++;
        await setState(o.id, { carrier_status: t.label || null, checked_at: now() });
        const msgs = wa.enabled && s.messages;
        if (t.state === "delivered") {
          await updateOrder(o, { status: "delivered" }, CARRIER_BOT);
          r.delivered++;
          if (msgs && !f.delivered_msg) {
            const id = await sendTemplate(o.phone, "dhi_delivered", [first(o), productLabel(o)], { orderId: o.id });
            if (id) await setState(o.id, {}, { delivered_msg: now() });
          }
        } else if (t.state === "out_for_delivery" && msgs && !f.ofd_msg) {
          const id = await sendTemplate(o.phone, "dhi_out_for_delivery", [first(o), productLabel(o), formatPrice(o.total)], { orderId: o.id });
          if (id) { r.outForDelivery++; await setState(o.id, {}, { ofd_msg: now() }); }
        } else if (t.state === "failed" && f.missed_msg !== t.label) {
          if (msgs) await sendTemplate(o.phone, "dhi_missed", [first(o), productLabel(o)], { orderId: o.id, payloads: [`CALLME:${o.id}`] });
          await setState(o.id, {}, { missed_msg: t.label });
          await notifyStaff(`📵 الليفرور ما لقاش الزبون: #${o.id} — ${o.customer_name} (${o.phone})\nWorld Express: ${t.label}\nعيّطلو قبل ما ترجع.`);
          r.missed++;
        } else if (t.state === "returned" && !f.return_alert) {
          // ما نبدلوش الحالة وحدنا (المخزون): نخبرو الفريق يتأكد
          await setState(o.id, {}, { return_alert: t.label });
          await notifyStaff(`↩️ World Express: «${t.label}» — #${o.id} — ${o.customer_name}\nتأكد وبدّل الحالة لـ «مرجع» من اللوحة.`);
          r.returns++;
        }
      } catch (e) {
        r.errors.push(`#${o.id}: ${(e as Error).message}`);
        await setState(o.id, { checked_at: now() });
        if (++failures >= 3) break; // شركة التوصيل ما راهيش تجاوب: نحبسو ونعاودو المرة الجاية
      }
    }
  }
  return r;
}

// كي تكون اللوحة محلولة نخدمو الدورة كل 10 دقايق (زيادة على الـ cron)
let last = 0;
export async function maybeTick() {
  if (Date.now() - last < 10 * 60_000) return;
  last = Date.now();
  try { await tick(); } catch (e) { console.error("tick:", e); }
}
