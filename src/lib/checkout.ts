// إنشاء طلبية (من الموقع ولا من اللوحة): التحقق + الحساب + المخزون + الحفظ
import { getProduct } from "./catalog";
import { getWilayas } from "./settings";
import { saveOrder, type Order } from "./orders";
import { adjustStock } from "./stock";
import { carrier, communes, type Commune } from "./ecotrack";
import { formatPrice } from "./config";

export type CheckoutInput = {
  product: string; // slug ولا id
  variant?: unknown;
  quantity?: unknown;
  wilaya?: unknown;
  method?: unknown;
  commune?: unknown;
  address?: unknown;
  name?: unknown;
  phone?: unknown;
  note?: unknown;
};

export type CheckoutResult =
  | { ok: true; order: Order }
  | { ok: false; status: number; errors?: Record<string, string>; error?: string; blocked?: boolean };

const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
// الأرقام العربية (٠١٢…) والفارسية (۰۱۲…) ← 0123
export const latinDigits = (s: string) => s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
// 0661 22 33 44 / +213661223344 / 00213… / 213… / 661223344 ← 0661223344
export function normPhone(v: unknown) {
  let d = latinDigits(typeof v === "string" ? v : String(v ?? "")).replace(/\D/g, "").slice(0, 15);
  if (d.startsWith("00213")) d = d.slice(5);
  else if (d.startsWith("213") && d.length === 12) d = d.slice(3);
  if (/^[567]\d{8}$/.test(d)) d = "0" + d;
  return d;
}
export const validPhone = (p: string) => /^0[567]\d{8}$/.test(p);
// مقارنة البلديات: بلا حروف كبار، بلا accents، بلا فراغات ولا شرطات
const key = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f\u064B-\u065F]/g, "").replace(/[^a-z0-9\u0621-\u064A]/g, "");

export async function placeOrder(input: CheckoutInput, opts: { ip?: string | null; extraNote?: string; by?: string; gate?: (o: Order) => Promise<CheckoutResult | null> | CheckoutResult | null } = {}): Promise<CheckoutResult> {
  const name = clean(input.name, 80);
  let handTyped = false;
  const phone = normPhone(input.phone);
  const wilayaCode = Number(input.wilaya);
  let commune = clean(input.commune, 80);
  const address = clean(input.address, 200);
  const method = input.method === "desk" ? "desk" : "home";
  const quantity = Math.min(Math.max(parseInt(String(input.quantity)) || 1, 1), 10);
  const note = clean(input.note, 300);

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "دخّل الاسم";
  if (!validPhone(phone)) errors.phone = "رقم الهاتف لازم يبدا بـ 05 / 06 / 07 وفيه 10 أرقام";
  const wilaya = (await getWilayas()).find((w) => w.code === wilayaCode);
  if (!wilaya) errors.wilaya = "اختار الولاية";
  if (commune.length < 2) errors.commune = method === "desk" ? "اختار المكتب" : "اختار البلدية";
  // البلديات والمكاتب من World Express: لازم البلدية تكون فالقائمة تاعهم
  let list: Commune[] = [];
  if (wilaya && carrier.enabled) { try { list = await communes(wilaya.code, true); } catch { list = []; } }
  // البلدية مكتوبة بطريقة أخرى؟ نلقاوها. ما لقيناهاش؟ نقبلو الطلبية ونخبرو الفريق (ما نحبسوش الزبون)
  if (wilaya && list.length && commune.length >= 2) {
    const c = list.find((x) => key(x.name) === key(commune));
    if (c) {
      commune = c.name;
      if (method === "desk" && !c.desk) errors.commune = "ما كانش مكتب فهاد البلدية، اختار مكتب من القائمة";
    } else handTyped = true;
  }
  if (wilaya && method === "desk" && list.length && !list.some((x) => x.desk)) errors.method = "ما كانش مكتب فهاد الولاية، اختار التوصيل للدار";

  const product = await getProduct(clean(input.product, 100));
  if (!product) return { ok: false, status: 400, error: "المنتج غير متوفر" };

  let unitPrice = product.price;
  let variant: string | null = null;
  if (product.variants.length) {
    const v = product.variants.find((x) => x.name === input.variant);
    if (!v) errors.variant = "اختار النوع";
    else { unitPrice = v.price; variant = v.name; }
  }

  const baseFee = wilaya ? (method === "desk" ? wilaya.desk : wilaya.home) : null;
  // توصيل مجاني لهاد المنتج: نفس الطرق (المكتب غير وين كاين) بصح بلا ثمن
  const fee = baseFee === null ? null : product.freeShipping ? 0 : baseFee;
  if (wilaya && fee === null) errors.method = "ما كانش مكتب فهاد الولاية، اختار التوصيل للدار";

  // العروض: عدد القطع بسعر كامل (غير للمنتجات بلا أنواع)
  const offer = !product.variants.length ? (product.offers || []).find((o) => o.qty === quantity) : undefined;
  const subtotal = offer ? offer.price : unitPrice * quantity;
  if (offer) unitPrice = Math.round(offer.price / offer.qty);

  if (Object.keys(errors).length) return { ok: false, status: 422, errors };

  const order: Order = {
    id: `${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`,
    created_at: new Date().toISOString(),
    status: "new",
    customer_name: name,
    phone,
    wilaya_code: wilaya!.code,
    wilaya_name: wilaya!.name,
    commune,
    address: method === "home" ? address : "",
    delivery_method: method,
    product_id: product.id,
    product_name: product.name,
    variant,
    quantity,
    unit_price: unitPrice,
    shipping_fee: fee!,
    total: subtotal + fee!,
    note: [opts.extraNote || "", handTyped ? "⚠️ البلدية مكتوبة باليد: تأكد منها قبل الإرسال" : "", offer ? `🎁 عرض: ${offer.qty} قطع بـ ${formatPrice(offer.price)}` : "", product.freeShipping ? "🚚 توصيل مجاني" : "", note].filter(Boolean).join(" — "),
    ip: opts.ip ?? null,
  };

  // الحظر وعدد المحاولات (من الموقع): بعد التحقق، قبل المخزون
  const stop = opts.gate ? await opts.gate(order) : null;
  if (stop) return stop;

  // المخزون: إذا كان متبوع، لازم يكفي، ونحجزوه للطلبية (فخطوة وحدة)
  const res = await adjustStock(product.id, -quantity, "order", order.id, opts.by || "زبون");
  if (res.tracked && !res.ok) {
    return { ok: false, status: 409, error: !res.stock ? "نفذ المخزون تاع هاد المنتج 😔 راسلنا على الواتساب" : `باقي غير ${res.stock} فالمخزون` };
  }
  order.stock_applied = res.tracked;

  try {
    await saveOrder(order);
  } catch (e) {
    if (res.tracked) await adjustStock(product.id, quantity, "order-failed", order.id, "النظام");
    console.error(e);
    return { ok: false, status: 500, error: "صرا مشكل، عاود جرّب ولا اتصل بينا على الواتساب" };
  }
  return { ok: true, order }; // تيليغرام والواتساب يخرجو من بعد (after) باش الزبون ما يستناش
}
