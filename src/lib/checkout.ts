// إنشاء طلبية (من الموقع ولا من اللوحة): التحقق + الحساب + المخزون + الحفظ
import { getProduct } from "./catalog";
import { getWilayas } from "./settings";
import { saveOrder, notifyTelegram, type Order } from "./orders";
import { adjustStock, availableStock } from "./stock";
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

const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const normPhone = (v: unknown) => clean(v, 20).replace(/[\s.-]/g, "").replace(/^(\+213|00213)/, "0");
export const validPhone = (p: string) => /^0[567]\d{8}$/.test(p);

export async function placeOrder(input: CheckoutInput, opts: { ip?: string | null; extraNote?: string; by?: string; gate?: (o: Order) => Promise<CheckoutResult | null> | CheckoutResult | null } = {}): Promise<CheckoutResult> {
  const name = clean(input.name, 80);
  const phone = normPhone(input.phone);
  const wilayaCode = Number(input.wilaya);
  const commune = clean(input.commune, 80);
  const address = clean(input.address, 200);
  const method = input.method === "desk" ? "desk" : "home";
  const quantity = Math.min(Math.max(parseInt(String(input.quantity)) || 1, 1), 10);
  const note = clean(input.note, 300);

  const errors: Record<string, string> = {};
  if (name.length < 3) errors.name = "دخّل الاسم الكامل";
  if (!validPhone(phone)) errors.phone = "رقم الهاتف لازم يبدا بـ 05 / 06 / 07 وفيه 10 أرقام";
  const wilaya = (await getWilayas()).find((w) => w.code === wilayaCode);
  if (!wilaya) errors.wilaya = "اختار الولاية";
  if (commune.length < 2) errors.commune = method === "desk" ? "اختار المكتب" : "اختار البلدية";
  // البلديات والمكاتب من World Express: لازم البلدية تكون فالقائمة تاعهم
  let list: Commune[] = [];
  if (wilaya && carrier.enabled) { try { list = await communes(wilaya.code, true); } catch { list = []; } }
  if (wilaya && list.length && commune.length >= 2) {
    const c = list.find((x) => x.name.toLowerCase() === commune.toLowerCase());
    if (!c) errors.commune = "اختار البلدية من القائمة";
    else if (method === "desk" && !c.desk) errors.commune = "ما كانش مكتب فهاد البلدية، اختار مكتب من القائمة";
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
    note: [opts.extraNote || "", offer ? `🎁 عرض: ${offer.qty} قطع بـ ${formatPrice(offer.price)}` : "", product.freeShipping ? "🚚 توصيل مجاني" : "", note].filter(Boolean).join(" — "),
    ip: opts.ip ?? null,
  };

  // الحظر وعدد المحاولات (من الموقع): بعد التحقق، قبل المخزون
  const stop = opts.gate ? await opts.gate(order) : null;
  if (stop) return stop;

  // المخزون: إذا كان متبوع، لازم يكفي، ونحجزوه للطلبية
  const avail = await availableStock(product.id);
  if (avail !== null && avail < quantity) {
    return { ok: false, status: 409, error: avail === 0 ? "نفذ المخزون تاع هاد المنتج 😔 راسلنا على الواتساب" : `باقي غير ${avail} فالمخزون` };
  }
  const res = await adjustStock(product.id, -quantity, "order", order.id, opts.by || "زبون");
  if (res.tracked && !res.ok) return { ok: false, status: 409, error: "نفذ المخزون تاع هاد المنتج 😔" };
  order.stock_applied = res.tracked;

  try {
    await saveOrder(order);
  } catch (e) {
    if (res.tracked) await adjustStock(product.id, quantity, "order-failed", order.id, "النظام");
    console.error(e);
    return { ok: false, status: 500, error: "صرا مشكل، عاود جرّب ولا اتصل بينا على الواتساب" };
  }
  await notifyTelegram(order);
  return { ok: true, order };
}
