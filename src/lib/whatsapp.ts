// واتساب الرسمي (WhatsApp Cloud API تاع Meta): رسائل التأكيد والتتبع
// المفاتيح فـ Vercel برك (ما يتكتبوش فالكود): WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN
import { createHmac, timingSafeEqual } from "crypto";
import { dbInsert, dbUpdate } from "./db";

const TOKEN = process.env.WHATSAPP_TOKEN?.trim();
const PHONE_ID = process.env.WHATSAPP_PHONE_ID?.trim();
const APP_SECRET = process.env.WHATSAPP_APP_SECRET?.trim();
export const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
const API = (process.env.WHATSAPP_API_URL?.trim() || "https://graph.facebook.com/v23.0").replace(/\/+$/, "");
const LANG = process.env.WHATSAPP_LANG?.trim() || "ar";

export const wa = { enabled: Boolean(TOKEN && PHONE_ID), webhook: Boolean(APP_SECRET && VERIFY_TOKEN) };

// 0661223344 ← 213661223344 (والعكس)
export const toIntl = (p: string) => "213" + p.replace(/\D/g, "").replace(/^(213|0)/, "");
export const toLocal = (p: string) => "0" + p.replace(/\D/g, "").replace(/^(213|0)/, "");

// القوالب (لازم تتسجل فـ WhatsApp Manager بنفس الاسم ونفس عدد المتغيرات)
export const TEMPLATES = {
  dhi_confirm: { vars: 4, buttons: ["✅ نأكد الطلبية", "❌ نلغي الطلبية"], text: "مرحبا {{1}} 👋\nوصلتنا طلبيتك من DHI Electronics:\n📦 {{2}}\n💵 المجموع: {{3}} (الدفع عند الاستلام)\n📍 {{4}}\nأكّد الطلبية باش نبعثوهالك 👇" },
  dhi_confirm_reminder: { vars: 2, buttons: ["✅ نأكد الطلبية", "❌ نلغي الطلبية"], text: "مرحبا {{1}}، مازال ما أكدتش طلبيتك ({{2}}) 🙏\nاضغط على الزر باش نبعثوهالك، ولا الغيها إذا ما حبيتهاش." },
  dhi_shipped: { vars: 4, buttons: [], text: "مرحبا {{1}} 🚚\nطلبيتك ({{2}}) خرجت مع شركة التوصيل.\nرقم التتبع: {{3}}\nحضّر {{4}} وخلّي تيليفونك مفتوح باش الليفرور يلقاك. شكراً!" },
  dhi_out_for_delivery: { vars: 3, buttons: [], text: "مرحبا {{1}} 📦\nالليفرور راه جاي بطلبيتك ({{2}}).\nخلّي تيليفونك مفتوح وحضّر {{3}}. شكراً!" },
  dhi_missed: { vars: 2, buttons: [], text: "مرحبا {{1}}، الليفرور حاول يوصلك طلبيتك ({{2}}) وما لقاكش 📵\nجاوب على التيليفون ولا ابعثلنا هنا باش نعاودو نبعثوهالك." },
  dhi_delivered: { vars: 2, buttons: [], text: "مرحبا {{1}} 🎉\nطلبيتك ({{2}}) وصلت. شكراً على ثقتك فـ DHI Electronics!\nإذا عندك أي سؤال على الاستعمال، ابعثلنا هنا." },
} as const;
export type TemplateName = keyof typeof TEMPLATES;

async function post(body: unknown) {
  const res = await fetch(`${API}/${PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `WhatsApp ${res.status}`);
  return String(data?.messages?.[0]?.id || "");
}

// السجل: كل رسالة تتحفظ (إذا الجدول مازال ما تزادش، ما نوقفوش)
export async function logMessage(m: { order_id?: string | null; phone: string; dir: "in" | "out"; kind: string; body: string; wa_id?: string | null; status?: string; error?: string | null }) {
  try { await dbInsert("wa_messages", { at: new Date().toISOString(), status: "", ...m, phone: toLocal(m.phone) }); }
  catch (e) { console.error("wa log:", String(e).slice(0, 200)); }
}

export async function markStatus(waId: string, status: string, error?: string) {
  try { await dbUpdate("wa_messages", { wa_id: waId }, { status, ...(error ? { error } : {}) }); } catch { /* الجدول ما كانش */ }
}

const fill = (t: string, v: string[]) => t.replace(/\{\{(\d+)\}\}/g, (_, i) => v[Number(i) - 1] ?? "");

// رسالة قالب (تقدر تبعثها فأي وقت) + أزرار الرد السريع (payload = الأمر:رقم الطلبية)
export async function sendTemplate(phone: string, name: TemplateName, vars: string[], opts: { orderId?: string; payloads?: string[] } = {}) {
  const t = TEMPLATES[name];
  const clean = vars.map((v) => String(v ?? "").replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim().slice(0, 300) || "-");
  const components: unknown[] = [{ type: "body", parameters: clean.map((text) => ({ type: "text", text })) }];
  (opts.payloads || []).forEach((payload, index) => components.push({ type: "button", sub_type: "quick_reply", index: String(index), parameters: [{ type: "payload", payload }] }));
  const body = fill(t.text, clean);
  if (!wa.enabled) return null;
  try {
    const id = await post({ messaging_product: "whatsapp", to: toIntl(phone), type: "template", template: { name, language: { code: LANG }, components } });
    await logMessage({ order_id: opts.orderId, phone, dir: "out", kind: name, body, wa_id: id, status: "sent" });
    return id;
  } catch (e) {
    await logMessage({ order_id: opts.orderId, phone, dir: "out", kind: name, body, status: "failed", error: (e as Error).message.slice(0, 300) });
    return null;
  }
}

// رسالة عادية: تخرج غير إذا الزبون بعثلنا فآخر 24 ساعة (قاعدة واتساب)
export async function sendText(phone: string, text: string, orderId?: string | null, kind = "text") {
  if (!wa.enabled) return null;
  try {
    const id = await post({ messaging_product: "whatsapp", to: toIntl(phone), type: "text", text: { body: text.slice(0, 4000) } });
    await logMessage({ order_id: orderId, phone, dir: "out", kind, body: text, wa_id: id, status: "sent" });
    return id;
  } catch (e) {
    await logMessage({ order_id: orderId, phone, dir: "out", kind, body: text, status: "failed", error: (e as Error).message.slice(0, 300) });
    throw e;
  }
}

// التوقيع تاع Meta: نتأكدو بلي الرسالة جاية من واتساب نيشان
export function validSignature(raw: string, header: string | null) {
  if (!APP_SECRET || !header?.startsWith("sha256=")) return false;
  const want = Buffer.from(createHmac("sha256", APP_SECRET).update(raw, "utf8").digest("hex"));
  const got = Buffer.from(header.slice(7));
  return want.length === got.length && timingSafeEqual(want, got);
}

export type Incoming = { from: string; id: string; text: string; payload: string | null; ts: string };
export type StatusUpdate = { id: string; status: string; error?: string };

// نقراو الويبهوك: الرسائل الداخلة (أزرار ولا كتابة) وحالة الرسائل الخارجة (وصلت/تقرات/فشلت)
export function parseWebhook(body: unknown): { messages: Incoming[]; statuses: StatusUpdate[] } {
  const messages: Incoming[] = [];
  const statuses: StatusUpdate[] = [];
  const entries = (body as { entry?: { changes?: { value?: Record<string, unknown> }[] }[] })?.entry || [];
  for (const e of entries) for (const c of e.changes || []) {
    const v = c.value || {};
    for (const m of (v.messages as Record<string, never>[] | undefined) || []) {
      const msg = m as Record<string, Record<string, unknown> | string>;
      const button = msg.button as Record<string, string> | undefined;
      const inter = msg.interactive as { button_reply?: { id: string; title: string } } | undefined;
      const text = (msg.text as { body?: string } | undefined)?.body || button?.text || inter?.button_reply?.title || `[${msg.type}]`;
      messages.push({ from: String(msg.from || ""), id: String(msg.id || ""), ts: String(msg.timestamp || ""), text: String(text), payload: button?.payload || inter?.button_reply?.id || null });
    }
    for (const s of (v.statuses as { id: string; status: string; errors?: { title?: string; message?: string }[] }[] | undefined) || []) {
      statuses.push({ id: s.id, status: s.status, error: s.errors?.[0]?.message || s.errors?.[0]?.title });
    }
  }
  return { messages, statuses };
}
