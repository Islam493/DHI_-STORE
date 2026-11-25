import { NextResponse } from "next/server";
import { getProduct } from "@/lib/catalog";
import { getSettings, getWilayas } from "@/lib/settings";
import { normPhone, validPhone } from "@/lib/checkout";
import { saveDraft } from "@/lib/abandoned";

// الفورميلار يبعث هنا (بلا ما يضغط الزبون) باش ما تضيعش الطلبية إذا خرج
const hits = new Map<string, number[]>();
function limited(key: string, max = 40) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < 10 * 60_000);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

const clean = (v: unknown, max = 100) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const ok = () => NextResponse.json({ ok: true });

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try { b = JSON.parse(await req.text()); } catch { return ok(); }
  if (!b || typeof b !== "object" || clean(b.hp)) return ok();

  const id = clean(b.draft, 40);
  const phone = normPhone(b.phone);
  if (!/^[a-z0-9]{10,40}$/i.test(id) || !validPhone(phone)) return ok();

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
  if (limited(`i:${ip}`, 150) || limited(`p:${phone}`)) return ok(); // الـ IP يتقاسموه بزاف زبائن

  try {
    const [{ blocked }, product, wilayas] = await Promise.all([getSettings(), getProduct(clean(b.product)), getWilayas()]);
    if (!product || blocked.phones.includes(phone) || (ip && blocked.ips.includes(ip))) return ok();

    const quantity = Math.min(Math.max(parseInt(String(b.quantity)) || 1, 1), 10);
    const method = b.method === "desk" ? "desk" : "home";
    const v = product.variants.find((x) => x.name === b.variant);
    const unit = v?.price ?? product.price;
    const offer = !product.variants.length ? (product.offers || []).find((o) => o.qty === quantity) : undefined;
    const w = wilayas.find((x) => x.code === Number(b.wilaya));
    const fee = !w || product.freeShipping ? 0 : (method === "desk" ? w.desk : w.home) ?? 0;

    await saveDraft({
      id,
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      variant: v?.name ?? null,
      quantity,
      wilaya_code: w?.code ?? null,
      wilaya_name: w?.name ?? "",
      commune: clean(b.commune, 80),
      delivery_method: method,
      name: clean(b.name, 80),
      phone,
      total: (offer ? offer.price : unit * quantity) + fee,
      ip,
    });
  } catch (e) {
    console.error("abandoned", e);
  }
  return ok();
}
