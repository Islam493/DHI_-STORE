import { categories, cleanOffers, emptyLanding, type Landing, type Product } from "@/lib/catalog";

const int = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? n : NaN; };

export function slugify(s: string) {
  const latin = s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return latin.length >= 3 ? latin.slice(0, 60) : `product-${Date.now().toString(36)}`;
}

// تنظيف وتحقق من معلومات المنتج اللي جاية من اللوحة
export function normalize(b: Record<string, unknown>, all: Product[], selfId?: string):
  { product: Omit<Product, "id"> } | { error: string } {
  const name = String(b.name || "").trim().slice(0, 150);
  if (name.length < 2) return { error: "اكتب اسم المنتج" };
  const price = int(b.price);
  if (Number.isNaN(price)) return { error: "السعر لازم يكون رقم" };
  const cmp = b.compareAtPrice === "" || b.compareAtPrice == null ? null : int(b.compareAtPrice);
  if (cmp !== null && Number.isNaN(cmp)) return { error: "السعر القديم لازم يكون رقم" };
  const category = categories.some((c) => c.slug === b.category) ? String(b.category) : categories[0].slug;
  let slug = String(b.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  if (!slug) slug = slugify(name);
  if (all.some((p) => p.slug === slug && p.id !== selfId)) return { error: "رابط المنتج مستعمل، بدّلو" };
  const images = (Array.isArray(b.images) ? b.images : []).map(String).filter((u) => u.startsWith("/") || u.startsWith("https://")).slice(0, 12);
  const variants = (Array.isArray(b.variants) ? b.variants : [])
    .map((v: { name?: unknown; price?: unknown }) => ({ name: String(v?.name || "").trim().slice(0, 60), price: int(v?.price) }))
    .filter((v) => v.name && !Number.isNaN(v.price));
  const landing = cleanLanding(b.landing);
  const description = String(b.description ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 200);
  return {
    product: {
      slug, name, tagline: String(b.tagline || "").trim().slice(0, 150), category,
      active: b.active !== false, price, compareAtPrice: cmp, variants, images, description,
      sort: typeof b.sort === "number" ? b.sort : undefined,
      ...(landing ? { landing } : {}),
      sku: b.sku ? String(b.sku).trim().slice(0, 40) : null,
      cost: b.cost === "" || b.cost == null ? null : (Number.isNaN(int(b.cost)) ? null : int(b.cost)),
      lowStock: b.lowStock === "" || b.lowStock == null ? null : (Number.isNaN(int(b.lowStock)) ? null : int(b.lowStock)),
      featured: b.featured === true,
      offers: cleanOffers(b.offers),
    },
  };
}

const t = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const arr = (v: unknown, max: number, len: number) => (Array.isArray(v) ? v : []).map((x) => t(x, len)).filter(Boolean).slice(0, max);

function cleanLanding(v: unknown): Landing | null {
  if (!v || typeof v !== "object") return null;
  const l = v as Record<string, unknown>;
  const e = emptyLanding();
  const problem = (l.problem || {}) as Record<string, unknown>;
  e.headline = t(l.headline, 160);
  e.story = t(l.story, 800);
  e.promise = t(l.promise, 160);
  if (typeof l.hideReviews === "boolean") e.hideReviews = l.hideReviews;
  e.sub = t(l.sub, 300);
  e.problem = { title: t(problem.title, 120), points: arr(problem.points, 6, 200) };
  e.benefits = (Array.isArray(l.benefits) ? l.benefits : []).map((x: Record<string, unknown>) => ({ icon: t(x?.icon, 8) || "✅", title: t(x?.title, 80), text: t(x?.text, 250) })).filter((x) => x.title).slice(0, 12);
  e.uses = arr(l.uses, 8, 60);
  e.notes = arr(l.notes, 6, 250);
  e.faqs = (Array.isArray(l.faqs) ? l.faqs : []).map((x: Record<string, unknown>) => ({ q: t(x?.q, 150), a: t(x?.a, 600) })).filter((x) => x.q && x.a).slice(0, 12);
  e.specs = Object.fromEntries(Object.entries((l.specs || {}) as Record<string, unknown>).map(([k, val]) => [t(k, 40), t(val, 60)]).filter(([k, val]) => k && val).slice(0, 15));
  return e;
}
