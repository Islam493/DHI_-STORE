// تنبيهات التيليفون (Web Push): بلاش، بلا تيليغرام، تخرج حتى كي يكون التطبيق مسكّر
import webpush from "web-push";
import { dbSelect, dbUpsert } from "./db";
import { store } from "./config";

export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string }; by?: string; ua?: string; at?: string };
type PushData = { vapid?: { publicKey: string; privateKey: string }; subs: PushSub[] };

// المفاتيح والأجهزة محفوظين فسطر خاص (id = 2) فـ settings: ما يخرجوش للمتصفح
const ROW = 2;
async function read(): Promise<PushData> {
  const [r] = await dbSelect<{ id: number; data: PushData }>("settings", { eq: { id: ROW }, limit: 1 }, { fresh: true });
  return { ...(r?.data || {}), subs: r?.data?.subs || [] };
}
async function write(d: PushData) {
  await dbUpsert("settings", { id: ROW, data: d, updated_at: new Date().toISOString() });
}

// أول مرة: نولّدو المفاتيح وحدنا (ما تحتاج تزيد والو فـ Vercel)
export async function vapid() {
  const d = await read();
  if (d.vapid?.publicKey && d.vapid.privateKey) return { data: d, keys: d.vapid };
  const keys = webpush.generateVAPIDKeys();
  const next = { ...d, vapid: keys };
  await write(next);
  return { data: next, keys };
}

export async function publicKey() {
  return (await vapid()).keys.publicKey;
}

export async function addSub(sub: PushSub) {
  const { data } = await vapid();
  const subs = data.subs.filter((s) => s.endpoint !== sub.endpoint);
  subs.push({ ...sub, at: new Date().toISOString() });
  await write({ ...data, subs: subs.slice(-30) });
  return subs.length;
}

export async function removeSub(endpoint: string) {
  const d = await read();
  await write({ ...d, subs: d.subs.filter((s) => s.endpoint !== endpoint) });
}

export async function subCount() {
  try { return (await read()).subs.length; } catch { return 0; }
}

// نبعثو لكل الأجهزة (ولا لجهاز واحد). الأجهزة اللي فاتو (410/404) نفسخوهم
export async function sendPush(msg: { title: string; body: string; url?: string; tag?: string }, only?: string) {
  let d: PushData;
  try { d = await read(); } catch { return 0; }
  if (!d.vapid || !d.subs.length) return 0;
  const contact = `mailto:noreply@${new URL(store.url).hostname}`;
  const payload = JSON.stringify(msg);
  const dead: string[] = [];
  let ok = 0;
  await Promise.all(d.subs.filter((s) => !only || s.endpoint === only).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, {
        vapidDetails: { subject: contact, publicKey: d.vapid!.publicKey, privateKey: d.vapid!.privateKey },
        TTL: 6 * 3600, urgency: "high",
      });
      ok++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) dead.push(s.endpoint);
      else console.error("push:", code, String((e as Error).message).slice(0, 150));
    }
  }));
  if (dead.length) await write({ ...d, subs: d.subs.filter((s) => !dead.includes(s.endpoint)) }).catch(() => {});
  return ok;
}
