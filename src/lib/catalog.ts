import seed from "@/data/products.json";
import { dbSelect, hasSupabase } from "./db";
import { getSettings } from "./settings";

export type Variant = { name: string; price: number };
export type Product = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  active: boolean;
  price: number;
  compareAtPrice: number | null;
  variants: Variant[];
  images: string[];
  description: string[];
  sort?: number;
};

export type ProductRow = {
  id: string; slug: string; name: string; tagline: string | null; category: string; active: boolean;
  price: number; compare_at_price: number | null; variants: Variant[]; images: string[];
  description: string; sort: number;
};

export { categories } from "./categories";
import { categories } from "./categories";

export const seedProducts = (seed as Product[]).map((p, i) => ({ ...p, sort: i }));

export const toRow = (p: Product): ProductRow => ({
  id: p.id, slug: p.slug, name: p.name, tagline: p.tagline || null, category: p.category, active: p.active,
  price: p.price, compare_at_price: p.compareAtPrice, variants: p.variants || [], images: p.images || [],
  description: (p.description || []).join("\n"), sort: p.sort ?? 0,
});

export const fromRow = (r: ProductRow): Product => ({
  id: r.id, slug: r.slug, name: r.name, tagline: r.tagline || "", category: r.category, active: r.active,
  price: r.price, compareAtPrice: r.compare_at_price, variants: r.variants || [], images: r.images || [],
  description: (r.description || "").split("\n").map((l) => l.trim()).filter(Boolean), sort: r.sort,
});

// كل المنتجات (حتى المخبيين). قبل ما تتنقل لقاعدة البيانات، نستعملو المنتجات القديمة.
export async function getAllProducts(fresh = false): Promise<Product[]> {
  try {
    const rows = await dbSelect<ProductRow>("products", { order: ["sort", "asc"] }, { tags: ["catalog"], fresh });
    if (rows.length) return rows.map(fromRow);
    const s = await getSettings(fresh);
    return s.seeded ? [] : seedProducts;
  } catch (e) {
    if (hasSupabase) console.error("catalog:", e);
    return seedProducts;
  }
}

export async function getProducts() {
  return (await getAllProducts()).filter((p) => p.active && p.price > 0 && p.images.length > 0);
}

export async function getProduct(slug: string) {
  const s = decodeURIComponent(slug);
  return (await getProducts()).find((p) => p.slug === s);
}

export function getCategory(slug: string) {
  return categories.find((c) => c.slug === slug);
}

export async function productsIn(category: string) {
  return (await getProducts()).filter((p) => p.category === category);
}

export function discountPercent(p: { price: number; compareAtPrice: number | null }) {
  if (!p.compareAtPrice || p.compareAtPrice <= p.price) return 0;
  return Math.round((1 - p.price / p.compareAtPrice) * 100);
}
