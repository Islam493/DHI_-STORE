// الطلبات المتروكة (السيرفر): حفظ المسودة، تحويلها لطلبية، القائمة
import { dbDelete, dbInsert, dbPage, dbSelect, dbUpdate } from "./db";
import type { Order } from "./order-types";
import { addToHistory, emptyHistory, type Cart, type CartStatus, type PhoneHistory } from "./abandoned-types";

export * from "./abandoned-types";
const T = "abandoned_carts";

// الجدول مازال ما تزادش فـ Supabase؟ نخدمو عادي بلاه
export const missingTable = (e: unknown) => /PGRST205|42P01|does not exist|Could not find the table/i.test(String(e));

type Draft = Omit<Cart, "created_at" | "updated_at" | "status" | "order_id" | "contacted_at" | "by">;

export async function saveDraft(d: Draft) {
  const now = new Date().toISOString();
  const fields = { ...d, updated_at: now } as Record<string, unknown>;
  delete fields.id;
  try {
    // نفس المسودة (نفس الزيارة) ولا نفس الرقم ونفس المنتج: نحدّثو، ما نكرروش
    let [cur] = await dbSelect<Cart>(T, { eq: { id: d.id }, limit: 1 }, { fresh: true });
    if (!cur) {
      const same = await dbSelect<Cart>(T, { eq: { phone: d.phone, product_id: d.product_id }, order: ["updated_at", "desc"], limit: 1 }, { fresh: true });
      if (same[0] && same[0].status !== "converted" && Date.now() - new Date(same[0].updated_at).getTime() < 7 * 86400_000) cur = same[0];
    }
    if (cur) {
      if (cur.status === "converted" || cur.status === "ignored") return;
      await dbUpdate(T, { id: cur.id }, fields);
      return;
    }
    // طلب هاد المنتج قبل شوية؟ ماشي متروكة
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const done = await dbSelect<Order>("orders", { eq: { phone: d.phone, product_id: d.product_id }, gte: { created_at: since }, limit: 1, select: "id" }, { fresh: true });
    if (done.length) return;
    await dbInsert(T, { ...d, created_at: now, updated_at: now, status: "open" });
  } catch (e) {
    if (!missingTable(e)) throw e;
  }
}

// المسودة تولي «متروكة» غير بعد 15 دقيقة بلا حركة (قبل هاك الزبون مازال يعمّر)
export const IDLE_MS = 15 * 60_000;
const idleBefore = () => new Date(Date.now() - IDLE_MS).toISOString();

// كي تتسجل طلبية: المسودة تاعها (وأي مسودة لنفس الرقم ونفس المنتج) تولي «ولات طلبية».
// إذا الزبون كمّل وحدو فنفس الدقايق (ما كانتش متروكة أصلاً) نفسخوها برك.
export async function markConverted(o: Order, draftId?: string, self = false) {
  try {
    const rows = await dbSelect<Cart>(T, { eq: { phone: o.phone }, limit: 50, select: "id,status,product_id,updated_at" }, { fresh: true });
    const mine = rows.filter((c) => (c.id === draftId || c.product_id === o.product_id) && c.status !== "converted");
    const patch = { status: "converted", order_id: o.id, updated_at: new Date().toISOString() };
    for (const c of mine) {
      if (self && c.status === "open" && Date.now() - new Date(c.updated_at).getTime() < IDLE_MS) await dbDelete(T, { id: c.id });
      else await dbUpdate(T, { id: c.id }, patch);
    }
    // الرقم تبدّل قبل الطلبية؟ نعلّمو المسودة بالـ id تاعها
    if (draftId && !rows.some((c) => c.id === draftId)) await dbUpdate(T, { id: draftId }, patch);
  } catch (e) {
    if (!missingTable(e)) throw e;
  }
}

export async function listCarts(status: CartStatus | "all", page: number, per = 30) {
  const filter = (st: CartStatus | "all") => st === "open" ? { eq: { status: "open" }, lt: { updated_at: idleBefore() } } : st === "all" ? {} : { eq: { status: st } };
  try {
    const [{ rows, total }, typing, ...counts] = await Promise.all([
      dbPage<Cart>(T, { ...filter(status), order: ["updated_at", "desc"], limit: per, offset: (page - 1) * per }),
      dbPage<Cart>(T, { eq: { status: "open" }, gte: { updated_at: idleBefore() }, select: "id", limit: 1 }).then((r) => r.total),
      ...(["open", "contacted", "converted", "ignored"] as const).map((s) => dbPage<Cart>(T, { ...filter(s), select: "id", limit: 1 }).then((r) => [s, r.total] as const)),
    ]);
    return { ready: true, rows, total, typing, counts: Object.fromEntries(counts) as Record<CartStatus, number> };
  } catch (e) {
    if (!missingTable(e)) throw e;
    return { ready: false, rows: [] as Cart[], total: 0, typing: 0, counts: { open: 0, contacted: 0, converted: 0, ignored: 0 } };
  }
}

export async function getCart(id: string) {
  const [c] = await dbSelect<Cart>(T, { eq: { id }, limit: 1 }, { fresh: true });
  return c;
}

export async function updateCart(id: string, patch: Partial<Cart>) {
  await dbUpdate(T, { id }, { ...patch, updated_at: new Date().toISOString() });
}

export async function deleteCart(id: string) {
  await dbDelete(T, { id });
}

// المسودات القدام (أكثر من 30 يوم) اللي ما ولاوش طلبيات: نفسخوهم (ما نخليوش أرقام الناس بلا سبب)
export async function purgeOld(days = 30) {
  const before = new Date(Date.now() - days * 86400_000).toISOString();
  const old = await dbSelect<Cart>(T, { lt: { updated_at: before }, in: { status: ["open", "contacted", "ignored"] }, limit: 500, select: "id" }, { fresh: true });
  for (const c of old) await dbDelete(T, { id: c.id });
  return old.length;
}

export async function openCount() {
  try { return (await dbPage<Cart>(T, { eq: { status: "open" }, lt: { updated_at: idleBefore() }, select: "id", limit: 1 })).total; }
  catch { return 0; }
}

// تاريخ كل رقم (الطلبيات اللي فاتو) + الطلبيات اللي تشبه مكررة (نفس الرقم ونفس المنتج فـ 3 أيام)
type Lite = Pick<Order, "id" | "phone" | "status" | "product_id" | "created_at">;
export async function phoneHistory(phones: string[]) {
  return (await phoneInsights(phones)).history;
}
export async function phoneInsights(phones: string[]) {
  const history: Record<string, PhoneHistory> = {};
  const dups: Record<string, string> = {}; // id الطلبية ← id الطلبية اللي قبلها
  const list = [...new Set(phones.filter(Boolean))];
  if (!list.length) return { history, dups };
  const rows = await dbSelect<Lite>("orders", { in: { phone: list }, order: ["created_at", "asc"], limit: 5000, select: "id,phone,status,product_id,created_at" }, { fresh: true });
  const dead = ["cancelled", "cancelled_client", "fake", "duplicate"];
  const seen: Lite[] = [];
  for (const r of rows) {
    addToHistory((history[r.phone] ||= emptyHistory()), r.status);
    const prev = seen.find((x) => x.phone === r.phone && x.product_id === r.product_id && !dead.includes(x.status)
      && new Date(r.created_at).getTime() - new Date(x.created_at).getTime() < 3 * 86400_000);
    if (prev) dups[r.id] = prev.id;
    seen.push(r);
  }
  return { history, dups };
}
