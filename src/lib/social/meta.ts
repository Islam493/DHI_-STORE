// فيسبوك وانستغرام (Meta Graph API): نقراو الرسائل والكومونتيرات اللي يجيو، ونبعثو الردود
// المفاتيح فـ Vercel برك: META_PAGE_TOKEN, META_PAGE_ID, META_APP_SECRET, META_VERIFY_TOKEN (و META_IG_ID اختياري)
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Channel } from "./knowledge";

const env = (k: string) => process.env[k]?.trim() || "";
const API = () => (env("META_GRAPH_URL") || "https://graph.facebook.com/v24.0").replace(/\/+$/, "");
export const pageId = () => env("META_PAGE_ID");
export const igId = () => env("META_IG_ID");
export const verifyToken = () => env("META_VERIFY_TOKEN");
const token = () => env("META_PAGE_TOKEN");

export const meta = {
  get send() { return Boolean(token() && pageId()); },
  get webhook() { return Boolean(env("META_APP_SECRET") && verifyToken()); },
  get instagram() { return Boolean(igId()); },
};
// العلامة اللي نحطوها على رسائل الروبوت: كي ترجع «echo» بلاها ← معناها واحد من الفريق جاوب بيدّو
export const BOT_TAG = "dhi-bot";

// التوقيع: نتأكدو بلي الطلب جاي من Meta نيشان
export function validSignature(raw: string, header: string | null) {
  const secret = env("META_APP_SECRET");
  if (!secret || !header?.startsWith("sha256=")) return false;
  const want = Buffer.from(createHmac("sha256", secret).update(raw, "utf8").digest("hex"));
  const got = Buffer.from(header.slice(7));
  return want.length === got.length && timingSafeEqual(want, got);
}

async function graph(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API()}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(j?.error?.error_user_msg || j?.error?.message || `Meta ${res.status}`).slice(0, 300));
  return j as { id?: string; message_id?: string; recipient_id?: string };
}

// رسالة فالخاص (Messenger ولا Instagram Direct): نفس الطريقة بالـ Page token
export async function sendDM(userId: string, text: string) {
  const r = await graph(`${pageId()}/messages`, { recipient: { id: userId }, messaging_type: "RESPONSE", message: { text: text.slice(0, 990), metadata: BOT_TAG } });
  return r.message_id || "";
}
// «يكتب...» باش يبان طبيعي
export async function typing(userId: string, on = true) {
  try { await graph(`${pageId()}/messages`, { recipient: { id: userId }, sender_action: on ? "typing_on" : "typing_off" }); } catch { /* ماشي مهم */ }
}
// رسالة خاصة لصاحب الكومونتير (Private Reply): مرة وحدة لكل كومونتير، فـ 7 أيام
export async function privateReply(commentId: string, text: string) {
  const r = await graph(`${pageId()}/messages`, { recipient: { comment_id: commentId }, message: { text: text.slice(0, 990), metadata: BOT_TAG } });
  return r.message_id || "";
}
// رد علني تحت الكومونتير
export async function publicReply(channel: Channel, commentId: string, text: string) {
  const r = channel === "instagram"
    ? await graph(`${commentId}/replies`, { message: text.slice(0, 300) })
    : await graph(`${commentId}/comments`, { message: text.slice(0, 300) });
  return r.id || "";
}

// اسم الزبون (مرة وحدة لكل محادثة). إذا Meta ما عطاتوش، نخليوه فارغ
export async function profileName(channel: Channel, userId: string) {
  try {
    const fields = channel === "instagram" ? "name,username" : "first_name,last_name";
    const res = await fetch(`${API()}/${userId}?fields=${fields}`, { headers: { Authorization: `Bearer ${token()}` }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) return "";
    const j = (await res.json()) as Record<string, string>;
    return (j.name || [j.first_name, j.last_name].filter(Boolean).join(" ") || j.username || "").slice(0, 80);
  } catch { return ""; }
}

// ---------- قراية الويبهوك ----------
export type InDM = { type: "dm"; channel: Channel; user: string; mid: string; text: string; at: string };
export type InEcho = { type: "echo"; channel: Channel; user: string; mid: string; text: string; bot: boolean };
export type InComment = { type: "comment"; channel: Channel; user: string; name: string; commentId: string; postId: string; parentId: string; text: string; at: string };
export type Incoming = InDM | InEcho | InComment;

type Obj = Record<string, unknown>;
const o = (v: unknown) => (v && typeof v === "object" ? (v as Obj) : {});
const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const when = (v: unknown) => { const n = Number(v); return new Date(Number.isFinite(n) && n > 0 ? (n < 1e12 ? n * 1000 : n) : Date.now()).toISOString(); };

export function parseWebhook(body: unknown): Incoming[] {
  const b = o(body);
  const channel: Channel | null = b.object === "page" ? "facebook" : b.object === "instagram" ? "instagram" : null;
  if (!channel) return [];
  const own = new Set([pageId(), igId()].filter(Boolean));
  const out: Incoming[] = [];
  for (const e of (b.entry as unknown[]) || []) {
    const entry = o(e);
    // الرسائل فالخاص
    for (const m of (entry.messaging as unknown[]) || []) {
      const ev = o(m), msg = o(ev.message), sender = s(o(ev.sender).id), recipient = s(o(ev.recipient).id);
      if (!ev.message) continue; // قرا، وصل، تفاعل...
      const atts = (msg.attachments as unknown[]) || [];
      const text = s(msg.text) || (atts.length ? `[${s(o(atts[0]).type) || "ملف"}]` : "");
      if (msg.is_echo) { out.push({ type: "echo", channel, user: recipient, mid: s(msg.mid), text, bot: s(msg.metadata) === BOT_TAG }); continue; }
      if (!sender || own.has(sender) || msg.is_deleted) continue;
      out.push({ type: "dm", channel, user: sender, mid: s(msg.mid), text, at: when(ev.timestamp) });
    }
    // الكومونتيرات
    for (const c of (entry.changes as unknown[]) || []) {
      const ch = o(c), v = o(ch.value), from = o(v.from);
      if (channel === "facebook" && ch.field === "feed" && v.item === "comment" && v.verb === "add") {
        if (!from.id || own.has(s(from.id))) continue;
        out.push({ type: "comment", channel, user: s(from.id), name: s(from.name), commentId: s(v.comment_id), postId: s(v.post_id), parentId: s(v.parent_id), text: s(v.message), at: when(v.created_time) });
      }
      if (channel === "instagram" && (ch.field === "comments" || ch.field === "live_comments")) {
        if (!from.id || own.has(s(from.id))) continue;
        out.push({ type: "comment", channel, user: s(from.id), name: s(from.username), commentId: s(v.id), postId: s(o(v.media).id), parentId: s(v.parent_id), text: s(v.text), at: new Date().toISOString() });
      }
    }
  }
  return out;
}
