// الروبوت: كل رسالة ولا كومونتير يجي من فيسبوك/انستغرام ← نسجلوه ← نجاوبو (إذا شاعل) ← ننبهو الفريق كي يلزم
// قواعد: ما نجاوبوش زوج مرات على نفس الرسالة، نسكتو كي واحد من الفريق يجاوب بيدّو، وما نكثروش الردود على نفس الشخص
import { dbInsert, dbSelect, dbUpsert } from "../db";
import { getSettings } from "../settings";
import { store } from "../config";
import { notifyStaff } from "../automation";
import { answer, type Answer, type Turn } from "./brain";
import { meta, privateReply, profileName, publicReply, sendDM, typing, type Incoming } from "./meta";
import type { Channel } from "./knowledge";

export type MsgKind = "dm" | "comment" | "reply" | "private_reply" | "public_reply" | "staff";
export type SocialMessage = {
  id?: number; at: string; channel: Channel; thread: string; kind: MsgKind; dir: "in" | "out";
  ext_id?: string | null; post_id?: string | null; body: string; intent?: string | null; handoff?: boolean;
  source?: string | null; status?: string; error?: string | null;
};
export type Thread = {
  id: string; channel: Channel; user_id: string; name: string; last_at: string; last_text: string;
  paused_until?: string | null; needs_human?: boolean; reason?: string | null; phone?: string | null; product?: string | null; updated_at?: string;
};

const M = "social_messages";
const T = "social_threads";
const now = () => new Date().toISOString();
const later = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString();
export const threadId = (channel: Channel, user: string) => `${channel}:${user}`;
export const FOREVER = "2100-01-01T00:00:00.000Z";
const paused = (t?: Thread | null) => Boolean(t?.paused_until && new Date(t.paused_until).getTime() > Date.now());

// ---------- التخزين ----------
async function seen(extId: string) {
  if (!extId) return false;
  try { return (await dbSelect<SocialMessage>(M, { eq: { ext_id: extId, dir: "in" }, limit: 1 }, { fresh: true })).length > 0; }
  catch { return false; }
}
// نسجلو الرسالة الداخلة. إذا ما تسجلتش (الجدول ناقص ولا تكرار) ← ما نجاوبوش (خير من جواب مكرر)
async function logIn(m: Omit<SocialMessage, "dir" | "at"> & { at?: string }) {
  try { await dbInsert(M, { status: "received", ...m, at: m.at || now(), dir: "in" }); return true; }
  catch (e) { console.error("social log in:", String(e).slice(0, 200)); return false; }
}
async function logOut(m: Omit<SocialMessage, "dir" | "at">) {
  try { await dbInsert(M, { status: "sent", ...m, at: now(), dir: "out" }); } catch (e) { console.error("social log out:", String(e).slice(0, 200)); }
}
export async function getThread(id: string): Promise<Thread | null> {
  try { return (await dbSelect<Thread>(T, { eq: { id }, limit: 1 }, { fresh: true }))[0] || null; } catch { return null; }
}
export async function saveThread(t: Partial<Thread> & { id: string }) {
  try { await dbUpsert(T, { ...t, updated_at: now() }, "id"); } catch (e) { console.error("social thread:", String(e).slice(0, 200)); }
}
async function history(thread: string, skipExt?: string): Promise<Turn[]> {
  try {
    const rows = await dbSelect<SocialMessage>(M, { eq: { thread }, order: ["at", "desc"], limit: 14 }, { fresh: true });
    return rows.reverse()
      .filter((r) => r.ext_id !== skipExt && r.kind !== "public_reply" && r.status !== "failed" && r.body)
      .map((r) => ({ from: r.dir === "in" ? "customer" : "bot", text: r.body }));
  } catch { return []; }
}

async function ensureThread(channel: Channel, user: string, name: string, text: string) {
  const id = threadId(channel, user);
  const cur = await getThread(id);
  const nm = name || cur?.name || (meta.send ? await profileName(channel, user) : "");
  await saveThread({ id, channel, user_id: user, name: nm, last_at: now(), last_text: text.slice(0, 300) });
  return { ...(cur || { id, channel, user_id: user }), name: nm } as Thread;
}

async function alert(t: Thread, a: Answer, text: string) {
  if (!a.handoff) return;
  const hours = (await getSettings()).social.humanHours || 12;
  // شكوى، طلبية، يحب يهدر مع الفريق ← الروبوت يسكت. سؤال ما عرفوش برك ← ننبهو الفريق والروبوت يكمّل يجاوب
  const pause = a.phone || ["complaint", "human", "after_sale", "order"].includes(a.intent);
  await saveThread({ id: t.id, needs_human: true, reason: a.reason || a.intent, ...(pause ? { paused_until: later(hours) } : {}), ...(a.phone ? { phone: a.phone } : {}), ...(a.product ? { product: a.product } : {}) });
  const where = t.channel === "instagram" ? "انستغرام" : "فيسبوك";
  await notifyStaff(
    `${a.phone ? "📞 زبون عطا رقمو" : "🙋 الروبوت يحتاجك"} (${where}): ${t.name || "زبون"}\n${a.reason || ""}${a.phone ? ` — ${a.phone}` : ""}\n«${text.slice(0, 160)}»\nشوف: ${store.url}/admin/social`,
    "/admin/social",
  ).catch(() => {});
}

// ---------- رسالة فالخاص ----------
async function onDM(ev: Extract<Incoming, { type: "dm" }>) {
  if (await seen(ev.mid)) return;
  const t = await ensureThread(ev.channel, ev.user, "", ev.text);
  if (!(await logIn({ channel: ev.channel, thread: t.id, kind: "dm", ext_id: ev.mid, body: ev.text, at: ev.at }))) return;
  const s = (await getSettings(true)).social;
  if (!s.enabled || !s.dm || !meta.send || paused(t)) return;

  await typing(ev.user);
  const a = await answer({ channel: ev.channel, kind: "dm", text: ev.text, name: t.name, history: await history(t.id, ev.mid) });
  if (a.reply) {
    try {
      const mid = await sendDM(ev.user, a.reply);
      await logOut({ channel: ev.channel, thread: t.id, kind: "dm", ext_id: mid, body: a.reply, intent: a.intent, handoff: a.handoff, source: a.source, error: a.error || null });
    } catch (e) {
      await logOut({ channel: ev.channel, thread: t.id, kind: "dm", body: a.reply, intent: a.intent, source: a.source, status: "failed", error: (e as Error).message });
    }
  }
  await alert(t, a, ev.text);
}

// ---------- كومونتير ----------
async function onComment(ev: Extract<Incoming, { type: "comment" }>) {
  if (await seen(ev.commentId)) return;
  const t = await ensureThread(ev.channel, ev.user, ev.name, ev.text);
  if (!(await logIn({ channel: ev.channel, thread: t.id, kind: "comment", ext_id: ev.commentId, post_id: ev.postId, body: ev.text, at: ev.at }))) return;
  const s = (await getSettings(true)).social;
  if (!s.enabled || !s.comments || !meta.send || paused(t)) return;

  // نفس الشخص على نفس المنشور: رد واحد فـ 24 ساعة (ما نبانوش روبوت يكرر)
  try {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const done = await dbSelect<SocialMessage>(M, { eq: { thread: t.id, dir: "out", post_id: ev.postId }, gte: { at: since }, limit: 1 }, { fresh: true });
    if (done.length) return;
  } catch { /* نكمّلو */ }

  const a = await answer({ channel: ev.channel, kind: "comment", text: ev.text, name: ev.name });
  if (a.intent === "spam" || (!a.reply && !a.publicReply)) return;
  const base = { channel: ev.channel, thread: t.id, post_id: ev.postId, intent: a.intent, handoff: a.handoff, source: a.source };
  if (s.publicReply && a.publicReply) {
    try { await logOut({ ...base, kind: "public_reply", ext_id: await publicReply(ev.channel, ev.commentId, a.publicReply), body: a.publicReply }); }
    catch (e) { await logOut({ ...base, kind: "public_reply", body: a.publicReply, status: "failed", error: (e as Error).message }); }
  }
  if (s.privateReply && a.reply) {
    try { await logOut({ ...base, kind: "private_reply", ext_id: await privateReply(ev.commentId, a.reply), body: a.reply, error: a.error || null }); }
    catch (e) { await logOut({ ...base, kind: "private_reply", body: a.reply, status: "failed", error: (e as Error).message }); }
  }
  await alert(t, a, ev.text);
}

// ---------- واحد من الفريق جاوب من Meta Business Suite ← الروبوت يسكت فهاد المحادثة ----------
async function onEcho(ev: Extract<Incoming, { type: "echo" }>) {
  if (ev.bot || !ev.user) return;
  const id = threadId(ev.channel, ev.user);
  // انستغرام ساعات ما يرجّعش العلامة: نستناو شوية ونشوفو واش هاد الرسالة خرجت من الروبوت
  await new Promise((r) => setTimeout(r, 3000));
  try {
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const mine = await dbSelect<SocialMessage>(M, { eq: { thread: id, dir: "out" }, gte: { at: since }, limit: 20 }, { fresh: true });
    if (mine.some((m) => m.source !== "staff" && (m.ext_id === ev.mid || m.body.trim() === ev.text.trim()))) return;
  } catch { /* نكمّلو */ }
  const hours = (await getSettings()).social.humanHours || 12;
  const cur = await getThread(id);
  await saveThread({ id, channel: ev.channel, user_id: ev.user, name: cur?.name || "", last_at: now(), last_text: ev.text.slice(0, 300), needs_human: false, paused_until: cur?.paused_until === FOREVER ? FOREVER : later(hours) });
  await logOut({ channel: ev.channel, thread: id, kind: "staff", ext_id: ev.mid, body: ev.text, source: "staff" });
}

export async function handle(ev: Incoming) {
  if (ev.type === "dm") return onDM(ev);
  if (ev.type === "comment") return onComment(ev);
  return onEcho(ev);
}

// ---------- للوحة ----------
export async function listThreads(limit = 60) {
  return dbSelect<Thread>(T, { order: ["last_at", "desc"], limit }, { fresh: true });
}
export async function threadMessages(id: string, limit = 60) {
  return (await dbSelect<SocialMessage>(M, { eq: { thread: id }, order: ["at", "desc"], limit }, { fresh: true })).reverse();
}
export async function socialReady() {
  try { await dbSelect(M, { limit: 1 }, { fresh: true }); await dbSelect(T, { limit: 1 }, { fresh: true }); return true; } catch { return false; }
}
export async function socialStats() {
  try {
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const rows = await dbSelect<SocialMessage>(M, { gte: { at: since }, select: "dir,kind,source,status,handoff", limit: 5000 }, { fresh: true });
    const n = (f: (r: SocialMessage) => boolean) => rows.filter(f).length;
    return {
      in: n((r) => r.dir === "in"), dm: n((r) => r.dir === "in" && r.kind === "dm"), comments: n((r) => r.dir === "in" && r.kind === "comment"),
      replied: n((r) => r.dir === "out" && r.source !== "staff" && r.status !== "failed"), failed: n((r) => r.status === "failed"),
      handoff: n((r) => r.dir === "out" && !!r.handoff), staff: n((r) => r.kind === "staff"),
    };
  } catch { return null; }
}
