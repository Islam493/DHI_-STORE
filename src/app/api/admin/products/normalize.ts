import { categories, type Product } from "@/lib/catalog";

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
  const description = String(b.description ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 200);
  return {
    product: {
      slug, name, tagline: String(b.tagline || "").trim().slice(0, 150), category,
      active: b.active !== false, price, compareAtPrice: cmp, variants, images, description,
      sort: typeof b.sort === "number" ? b.sort : undefined,
    },
  };
}
