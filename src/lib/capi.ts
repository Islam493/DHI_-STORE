// Meta Conversions API (من السيرفر): نقولو لفيسبوك شكون اشترى بالصح، باش يجيب زبائن كيفهم
// - Purchase كي تدخل الطلبية: نفس event_id تاع البيكسل (o_<id>) ← ما تتحسبش زوج مرات، بصح فيها رقم الزبون مشفّر
// - OrderConfirmed كي تتأكد الطلبية، OrderDelivered كي يستلمها الزبون (هادو ما يبعثهمش البيكسل)
// يخدم غير كي يكون META_CAPI_TOKEN فـ Vercel. الرقم والاسم والبلدية يخرجو مشفّرين (SHA-256)، عمرهم ما يخرجو واضحين.
import { createHash } from "node:crypto";
import { dbSelect, dbUpsert } from "./db";
import { getSettings } from "./settings";
import { store } from "./config";
import type { Order, Status } from "./order-types";

export type Ctx = { fbp?: string; fbc?: string; ua?: string; url?: string };
export type Kind = "purchase" | "confirmed" | "delivered";
type Row = { order_id: string; flags: { ctx?: Ctx; sent?: Partial<Record<Kind, string>>; err?: string } };
type Sent = { ok: true; received: number } | { ok: false; error: string };

export const EVENTS: Record<Kind, string> = { purchase: "Purchase", confirmed: "OrderConfirmed", delivered: "OrderDelivered" };
const PREFIX: Record<Kind, string> = { purchase: "o_", confirmed: "c_", delivered: "d_" };
// الحالات اللي معناها «الزبون أكّد» (حتى اللي فاتت مباشرة للإرسال)
const CONFIRMED: Status[] = ["confirmed", "preparing", "ready", "shipped", "delivered"];

const token = () => process.env.META_CAPI_TOKEN?.trim() || "";
const api = () => (process.env.META_CAPI_URL?.trim() || "https://graph.facebook.com/v24.0").replace(/\/+$/, "");
export const capi = { get enabled() { return Boolean(token()); }, get testCode() { return process.env.META_CAPI_TEST_CODE?.trim() || ""; } };

export async function pixelId() {
  const env = process.env.META_PIXEL_ID?.replace(/\D/g, "");
  if (env) return env;
  return (await getSettings()).pixels.facebook.replace(/\D/g, "");
}

// ---------- التشفير (كيما يطلب فيسبوك: حروف صغار، بلا فراغات) ----------
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const norm = (v: string) => v.toLowerCase().normalize("NFD").replace(/[̀-ًͯ-ٟ]/g, "").replace(/[^a-zء-ي]/g, "");
const intl = (p: string) => p.replace(/\D/g, "").replace(/^0/, "213"); // 0661223344 ← 213661223344
const hashed = (v: string) => (v ? [sha(v)] : undefined);

function userData(o: Order, c: Ctx) {
  const [first = "", ...rest] = o.customer_name.trim().split(/\s+/);
  const phone = intl(o.phone);
  const u: Record<string, unknown> = {
    ph: hashed(phone),
    external_id: hashed(phone),
    fn: hashed(norm(first)),
    ln: hashed(norm(rest.join(""))),
    ct: hashed(norm(o.commune || "")),
    st: hashed(norm(o.wilaya_name || "")),
    country: [sha("dz")],
    client_ip_address: o.ip || undefined,
    client_user_agent: c.ua || undefined,
    fbp: c.fbp || undefined,
    fbc: c.fbc || undefined,
  };
  for (const k of Object.keys(u)) if (u[k] === undefined) delete u[k];
  return u;
}

function event(kind: Kind, o: Order, c: Ctx) {
  const web = Boolean(c.ua); // جات من الموقع (عندنا المتصفح تاعو)
  const at = kind === "purchase" ? new Date(o.created_at).getTime() : Date.now();
  return {
    event_name: EVENTS[kind],
    event_time: Math.floor((Number.isFinite(at) ? at : Date.now()) / 1000),
    event_id: PREFIX[kind] + o.id,
    action_source: web ? "website" : "system_generated",
    ...(web ? { event_source_url: c.url || `${store.url}/` } : {}),
    user_data: userData(o, c),
    custom_data: {
      currency: "DZD",
      value: o.total,
      order_id: o.id,
      content_type: "product",
      content_ids: [o.product_id],
      content_name: o.product_name,
      num_items: o.quantity,
      contents: [{ id: o.product_id, quantity: o.quantity, item_price: o.unit_price }],
    },
  };
}

// ---------- الإرسال ----------
export async function sendEvents(events: object[], test?: string): Promise<Sent> {
  const t = token();
  if (!t) return { ok: false, error: "META_CAPI_TOKEN مازال ما تزادش فـ Vercel" };
  const px = await pixelId();
  if (!px) return { ok: false, error: "رقم البيكسل (Facebook Pixel) ما كاينش فالإعدادات" };
  const code = test || capi.testCode;
  try {
    const r = await fetch(`${api()}/${px}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: events, access_token: t, ...(code ? { test_event_code: code } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: String(j?.error?.error_user_msg || j?.error?.message || `HTTP ${r.status}`).slice(0, 300) };
    return { ok: true, received: Number(j.events_received) || 0 };
  } catch (e) {
    return { ok: false, error: String((e as Error).message || e).slice(0, 200) };
  }
}

// معلومات كل طلبية (المتصفح، fbp/fbc، واش تبعث): سطر وحدو فـ order_automation باش ما يتخلطش مع الواتساب
const T = "order_automation";
const key = (id: string) => `capi:${id}`;
async function getRow(id: string): Promise<Row> {
  try {
    const [r] = await dbSelect<Row>(T, { eq: { order_id: key(id) }, limit: 1 }, { fresh: true });
    return r ? { ...r, flags: r.flags || {} } : { order_id: key(id), flags: {} };
  } catch { return { order_id: key(id), flags: {} }; }
}
async function saveRow(r: Row) {
  try { await dbUpsert(T, { order_id: r.order_id, flags: r.flags, updated_at: new Date().toISOString() }, "order_id"); }
  catch (e) { console.error("capi state:", String(e).slice(0, 200)); }
}
async function deliver(o: Order, kinds: Kind[], row: Row) {
  const todo = kinds.filter((k) => !row.flags.sent?.[k]);
  if (!todo.length) return;
  const ctx = row.flags.ctx || {};
  const r = await sendEvents(todo.map((k) => event(k, o, ctx)));
  if (r.ok) {
    const at = new Date().toISOString();
    row.flags.sent = { ...row.flags.sent, ...Object.fromEntries(todo.map((k) => [k, at])) };
    delete row.flags.err;
  } else {
    row.flags.err = `${todo.join("+")}: ${r.error}`;
    console.error("capi:", row.flags.err);
  }
  await saveRow(row);
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export function readCtx(body: Record<string, unknown>, req: Request): Ctx {
  const fbp = clip(body.fbp, 120), fbc = clip(body.fbc, 500), url = clip(body.src, 500);
  return {
    fbp: /^fb\.\d\.\d+\.\S+$/.test(fbp) ? fbp : undefined,
    fbc: /^fb\.\d\.\d+\.\S+$/.test(fbc) ? fbc : undefined,
    ua: clip(req.headers.get("user-agent"), 400) || undefined,
    url: /^https?:\/\//.test(url) ? url : undefined,
  };
}

// طلبية جديدة من الموقع: نحفظو معلومات المتصفح (حتى إذا المفتاح مازال ما تزادش) ونبعثو Purchase
export async function capiOrderCreated(o: Order, ctx: Ctx) {
  const row: Row = { order_id: key(o.id), flags: { ctx } };
  if (!capi.enabled) { if (ctx.fbp || ctx.fbc || ctx.ua) await saveRow(row); return; }
  await deliver(o, ["purchase"], row);
}

// تبدّلت الحالة: مؤكدة ← OrderConfirmed، مستلمة ← OrderDelivered (مرة وحدة لكل طلبية)
export async function capiStatus(o: Order, status: string) {
  if (!capi.enabled) return;
  const kinds: Kind[] = [];
  if (CONFIRMED.includes(status as Status)) kinds.push("confirmed");
  if (status === "delivered") kinds.push("delivered");
  if (!kinds.length) return;
  await deliver(o, kinds, await getRow(o.id));
}

// زر التجربة فاللوحة: حدث تجربة يبان فـ «Évènements de test» (ما يتحسبش فالإعلانات)
export async function capiTest(code: string) {
  const fake: Order = {
    id: `TEST${Date.now().toString(36).toUpperCase()}`, created_at: new Date().toISOString(), status: "confirmed",
    customer_name: "Test DHI", phone: "0550000000", wilaya_code: 16, wilaya_name: "Alger", commune: "Alger Centre", address: "",
    delivery_method: "home", product_id: "test", product_name: "Test", variant: null, quantity: 1, unit_price: 1000,
    shipping_fee: 0, total: 1000, note: "", ip: null,
  };
  return sendEvents([event("confirmed", fake, { ua: "DHI admin test", url: `${store.url}/` })], code);
}

// حالة الربط للوحة: شحال تبعث فآخر الطلبيات، وآخر غلطة (إذا كاينة)
export async function capiStats() {
  const out = { enabled: capi.enabled, pixel: await pixelId().catch(() => ""), test: Boolean(capi.testCode), orders: 0, sent: { purchase: 0, confirmed: 0, delivered: 0 } as Record<Kind, number>, lastError: "", lastAt: "" };
  try {
    const rows = (await dbSelect<Row & { updated_at?: string }>(T, { search: { cols: ["order_id"], term: "capi" }, order: ["updated_at", "desc"], limit: 200 }, { fresh: true }))
      .filter((r) => r.order_id.startsWith("capi:"));
    out.orders = rows.length;
    for (const r of rows) {
      for (const k of Object.keys(out.sent) as Kind[]) if (r.flags?.sent?.[k]) out.sent[k]++;
      if (!out.lastError && r.flags?.err) out.lastError = r.flags.err;
      if (!out.lastAt && r.flags?.sent) out.lastAt = Object.values(r.flags.sent).sort().pop() || "";
    }
  } catch { /* الجدول مازال ما تزادش */ }
  return out;
}
