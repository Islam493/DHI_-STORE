// واش يعرف الروبوت: المنتجات الحقيقية من الكتالوج، الأسعار، العروض، التوصيل، وأرقام التواصل
// كلشي يجي من اللوحة (ما نكتبو والو باليد) ← كي تبدّل سعر، الروبوت يعرفو وحدو
import { getProducts, isOut, type Product } from "../catalog";
import { contacts, getSettings, getWilayas } from "../settings";
import { formatPrice, store } from "../config";

export type Channel = "facebook" | "instagram";
export type BotProduct = { slug: string; name: string; price: number };
export type Knowledge = { text: string; products: BotProduct[]; whatsapp: string; phone: string };

// ما نشهّروش بيهم فـ فيسبوك/انستغرام (سياسات Meta تبلوكي الحساب): ما يدخلوش أصلاً فمعرفة الروبوت
const HIDDEN_CATEGORIES = new Set(["hidden", "phones"]);
const HIDDEN_NAME = /super\s*copy|copie|كوبي|مقل+د|تجسس|spy/i;
export const botVisible = (p: Product) => !HIDDEN_CATEGORIES.has(p.category) && !HIDDEN_NAME.test(p.name);

const clip = (s: string | undefined, n: number) => {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

function productBlock(p: Product) {
  const l = p.landing;
  const lines = [`### ${p.name}`, `slug: ${p.slug}`, `الرابط: {{link:${p.slug}}}`];
  lines.push(`السعر: ${formatPrice(p.price)}${p.compareAtPrice && p.compareAtPrice > p.price ? ` (بلاصة ${formatPrice(p.compareAtPrice)})` : ""}`);
  if (p.variants?.length) lines.push(`الأنواع: ${p.variants.map((v) => `${v.name} = ${formatPrice(v.price)}`).join("، ")}`);
  if (p.offers?.length) lines.push(`العروض: ${p.offers.map((o) => `${o.qty} قطع بـ ${formatPrice(o.price)}`).join("، ")}`);
  lines.push(p.freeShipping ? "التوصيل: مجاني (للدار وللمكتب)" : "التوصيل: حسب الولاية (الجدول تحت)");
  if (isOut(p)) lines.push("المخزون: نفذ دركا (ما تقولش متوفر)");
  if (p.tagline) lines.push(`باختصار: ${clip(p.tagline, 200)}`);
  if (l?.sub) lines.push(`الوصف: ${clip(l.sub, 400)}`);
  if (l?.benefits?.length) lines.push(`المميزات: ${l.benefits.map((b) => `${clip(b.title, 60)}: ${clip(b.text, 160)}`).join(" | ")}`);
  const specs = Object.entries(l?.specs || {});
  if (specs.length) lines.push(`المواصفات: ${specs.map(([k, v]) => `${k}: ${v}`).join("، ")}`);
  if (l?.uses?.length) lines.push(`الاستعمال: ${l.uses.join("، ")}`);
  if (l?.notes?.length) lines.push(`ملاحظات: ${l.notes.map((n) => clip(n, 200)).join(" | ")}`);
  if (l?.faqs?.length) lines.push(`أسئلة: ${l.faqs.slice(0, 6).map((f) => `س: ${clip(f.q, 120)} ج: ${clip(f.a, 240)}`).join(" | ")}`);
  if (!l && p.description?.length) lines.push(`الوصف: ${clip(p.description.join(" "), 500)}`);
  return lines.join("\n");
}

async function build(): Promise<Knowledge> {
  const [all, s, wilayas] = await Promise.all([getProducts(), getSettings(), getWilayas()]);
  const products = all.filter(botVisible);
  const c = contacts(s);
  const whatsapp = c.whatsapps[0]?.n || s.whatsapp;
  const phone = c.phones[0]?.n || s.phone;
  const fees = wilayas.map((w) => `${w.code} ${w.name}: الدار ${formatPrice(w.home)}${w.desk ? `، المكتب ${formatPrice(w.desk)}` : "، ما كانش مكتب"}`);
  const ct = s.content;

  const text = [
    `# المتجر: ${store.name} (${store.nameAr})`,
    `الموقع: {{shop}}`,
    `الطلب: من صفحة المنتج فالموقع (فورم: الاسم، الهاتف، الولاية، البلدية). الفريق يعيط للزبون باش يأكد قبل ما يبعث.`,
    `الدفع: عند الاستلام (ما يخلص حتى دورو قبل).`,
    `التوصيل: 58 ولاية، للدار ولا لمكتب شركة التوصيل (المكتب غير فالولايات اللي فيها مكتب). مدة التوصيل تختلف حسب الولاية ونقولوها كي نأكدو.`,
    `الهاتف: ${c.phones.map((x) => x.n).join(" / ")}`,
    `الواتساب: ${c.whatsapps.map((x) => x.n).join(" / ")}`,
    ct.successOrders ? `عدد الطلبيات الناجحة (رقم صاحب المتجر): +${ct.successOrders}` : "",
    ct.warranty ? `الضمان: ${clip(ct.warranty, 300)}` : "الضمان: ما تعطيش مدة ضمان؛ قول نأكدوه معاك فالهاتف.",
    ct.returns?.length ? `المشاكل والإرجاع: ${ct.returns.map((r) => clip(r, 200)).join(" ")}` : "",
    ct.delivery?.length ? `معلومات التوصيل: ${ct.delivery.map((r) => clip(r, 200)).join(" ")}` : "",
    ct.faqs?.length ? `أسئلة عامة: ${ct.faqs.map((f) => `س: ${clip(f.q, 100)} ج: ${clip(f.a, 220)}`).join(" | ")}` : "",
    "",
    `# المنتجات (${products.length})`,
    ...products.map(productBlock),
    "",
    "# سعر التوصيل حسب الولاية (إلا إذا المنتج توصيلو مجاني)",
    ...fees,
  ].filter((l) => l !== "").join("\n");

  return { text, products: products.map((p) => ({ slug: p.slug, name: p.name, price: p.price })), whatsapp, phone };
}

// نخبّيوها 5 دقايق (الكتالوج ما يتبدلش كل ثانية، والنص يبقى هو هو ← الكاش تاع الذكاء الاصطناعي يخدم)
let cache: { at: number; k: Knowledge } | null = null;
export async function getKnowledge(fresh = false): Promise<Knowledge> {
  if (!fresh && cache && Date.now() - cache.at < 5 * 60_000) return cache.k;
  const k = await build();
  cache = { at: Date.now(), k };
  return k;
}

// الروابط: الروبوت يكتب {{link:slug}} ولا {{shop}}، واحنا نحطو الرابط الصحيح (ما يخترعش روابط)
export function linkFor(slug: string | null, channel: Channel) {
  const u = new URL(slug ? `/products/${encodeURIComponent(slug)}` : "/", store.url);
  u.searchParams.set("utm_source", channel);
  u.searchParams.set("utm_medium", "bot");
  return u.toString();
}
export function fillLinks(text: string, k: Knowledge, channel: Channel) {
  const known = new Set(k.products.map((p) => p.slug));
  return text
    .replace(/\{\{\s*link:([^}\s]+)\s*\}\}/g, (_, slug: string) => (known.has(slug) ? linkFor(slug, channel) : linkFor(null, channel)))
    .replace(/\{\{\s*shop\s*\}\}/g, linkFor(null, channel))
    .replace(/\{\{[^}]*\}\}/g, "")
    // رابط كتبو وحدو (ماشي تاع المتجر) ← نحيّوه
    .replace(/https?:\/\/\S+/g, (u) => (u.startsWith(store.url) ? u : ""))
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
