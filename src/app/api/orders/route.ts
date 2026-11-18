import { NextResponse } from "next/server";
import { getProduct } from "@/lib/catalog";
import { getSettings, getWilayas } from "@/lib/settings";
import { saveOrder, notifyTelegram, type Order } from "@/lib/orders";
import { adjustStock, availableStock } from "@/lib/stock";

// حماية بسيطة من الطلبات المتكررة: 3 طلبيات كل 10 دقايق لنفس الرقم/IP
const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < 10 * 60_000);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > 3;
}

const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  // فخ للروبوتات (حقل مخفي)
  if (clean(body.website)) return NextResponse.json({ ok: true, id: "0" });

  const name = clean(body.name, 80);
  const phone = clean(body.phone, 20).replace(/[\s.-]/g, "").replace(/^(\+213|00213)/, "0");
  const wilayaCode = Number(body.wilaya);
  const commune = clean(body.commune, 80);
  const address = clean(body.address, 200);
  const method = body.method === "desk" ? "desk" : "home";
  const quantity = Math.min(Math.max(parseInt(String(body.quantity)) || 1, 1), 10);
  const note = clean(body.note, 300);

  const errors: Record<string, string> = {};
  if (name.length < 3) errors.name = "دخّل الاسم الكامل";
  if (!/^0[567]\d{8}$/.test(phone)) errors.phone = "رقم الهاتف لازم يبدا بـ 05 / 06 / 07 وفيه 10 أرقام";
  const wilaya = (await getWilayas()).find((w) => w.code === wilayaCode);
  if (!wilaya) errors.wilaya = "اختار الولاية";
  if (commune.length < 2) errors.commune = "دخّل البلدية";
  if (method === "home" && address.length < 3) errors.address = "دخّل العنوان";

  const product = await getProduct(clean(body.product, 100));
  if (!product) return NextResponse.json({ error: "المنتج غير متوفر" }, { status: 400 });

  let unitPrice = product.price;
  let variant: string | null = null;
  if (product.variants.length) {
    const v = product.variants.find((x) => x.name === body.variant);
    if (!v) errors.variant = "اختار النوع";
    else { unitPrice = v.price; variant = v.name; }
  }

  const fee = wilaya ? (method === "desk" ? wilaya.desk : wilaya.home) : null;
  if (wilaya && fee === null) errors.method = "ما كانش مكتب فهاد الولاية، اختار التوصيل للدار";

  if (Object.keys(errors).length) return NextResponse.json({ errors }, { status: 422 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
  // الأرقام والـ IP المحظورين: نرجعو "نجحت" بلا ما نحفظو (المحتال ما يعرفش)
  const { blocked } = await getSettings();
  if (blocked.phones.includes(phone) || (ip && blocked.ips.includes(ip))) {
    return NextResponse.json({ ok: true, id: Date.now().toString(36).toUpperCase(), total: 0 });
  }
  if (limited(`p:${phone}`) || (ip && limited(`i:${ip}`))) {
    return NextResponse.json({ error: "بعثت بزاف طلبيات. عاود بعد شوية ولا اتصل بينا." }, { status: 429 });
  }

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
    total: unitPrice * quantity + fee!,
    note,
    ip,
  };

  // المخزون: إذا كان متبوع، لازم يكفي، ونحجزوه للطلبية
  const avail = await availableStock(product.id);
  if (avail !== null && avail < quantity) {
    return NextResponse.json({ error: avail === 0 ? "نفذ المخزون تاع هاد المنتج 😔 راسلنا على الواتساب" : `باقي غير ${avail} فالمخزون` }, { status: 409 });
  }
  const res = await adjustStock(product.id, -quantity, "order", order.id, "زبون");
  if (res.tracked && !res.ok) return NextResponse.json({ error: "نفذ المخزون تاع هاد المنتج 😔" }, { status: 409 });
  order.stock_applied = res.tracked;

  try {
    await saveOrder(order);
  } catch (e) {
    if (res.tracked) await adjustStock(product.id, quantity, "order-failed", order.id, "النظام");
    console.error(e);
    return NextResponse.json({ error: "صرا مشكل، عاود جرّب ولا اتصل بينا على الواتساب" }, { status: 500 });
  }
  await notifyTelegram(order);

  return NextResponse.json({ ok: true, id: order.id, total: order.total });
}
