import seed from "@/data/products.json";
import landingSeed from "@/data/landing.json";
import { dbSelect, hasSupabase } from "./db";
import { getSettings } from "./settings";

export type Variant = { name: string; price: number };

// محتوى صفحة الهبوط تاع كل منتج (يتبدل من اللوحة)
export type Landing = {
  headline: string;
  sub: string;
  problem: { title: string; points: string[] };
  benefits: { icon: string; title: string; text: string }[];
  uses: string[];
  notes: string[];
  faqs: { q: string; a: string }[];
  specs: Record<string, string>;
};
const landings = landingSeed as Record<string, Landing>;
export const emptyLanding = (): Landing => ({ headline: "", sub: "", problem: { title: "", points: [] }, benefits: [], uses: [], notes: [], faqs: [], specs: {} });
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
  landing?: Landing;
  stock?: number | null; // فارغ = ما نتبعوش المخزون
  lowStock?: number | null;
  sku?: string | null;
  cost?: number | null; // سعر الشراء (للمدير برك)
  featured?: boolean;
};

export type ProductRow = {
  id: string; slug: string; name: string; tagline: string | null; category: string; active: boolean;
  price: number; compare_at_price: number | null; variants: Variant[]; images: string[];
  description: string; sort: number; landing?: Landing | null;
  stock?: number | null; low_stock?: number | null; sku?: string | null; cost?: number | null; featured?: boolean;
};

export { categories } from "./categories";
import { categories } from "./categories";

export const seedProducts = (seed as Product[]).map((p, i) => ({ ...p, sort: i, landing: landings[p.slug] }));

export const toRow = (p: Product): ProductRow => ({
  id: p.id, slug: p.slug, name: p.name, tagline: p.tagline || null, category: p.category, active: p.active,
  price: p.price, compare_at_price: p.compareAtPrice, variants: p.variants || [], images: p.images || [],
  description: (p.description || []).join("\n"), sort: p.sort ?? 0,
  ...(p.landing ? { landing: p.landing } : {}),
  ...(p.stock !== undefined ? { stock: p.stock } : {}),
  ...(p.lowStock !== undefined ? { low_stock: p.lowStock } : {}),
  ...(p.sku !== undefined ? { sku: p.sku } : {}),
  ...(p.cost !== undefined ? { cost: p.cost } : {}),
  ...(p.featured !== undefined ? { featured: p.featured } : {}),
});

export const fromRow = (r: ProductRow): Product => ({
  id: r.id, slug: r.slug, name: r.name, tagline: r.tagline || "", category: r.category, active: r.active,
  price: r.price, compareAtPrice: r.compare_at_price, variants: r.variants || [], images: r.images || [],
  description: (r.description || "").split("\n").map((l) => l.trim()).filter(Boolean), sort: r.sort,
  landing: r.landing && r.landing.headline ? r.landing : landings[r.slug],
  stock: typeof r.stock === "number" ? r.stock : null,
  lowStock: typeof r.low_stock === "number" ? r.low_stock : null,
  sku: r.sku || null,
  cost: typeof r.cost === "number" ? r.cost : null,
  featured: !!r.featured,
});

// المتجر ما يشوفش سعر الشراء
export const publicProduct = (p: Product): Product => ({ ...p, cost: undefined });
export const isOut = (p: Product) => typeof p.stock === "number" && p.stock <= 0;
export const isLow = (p: Product) => typeof p.stock === "number" && p.stock > 0 && p.stock <= (p.lowStock ?? 3);

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
  return (await getAllProducts()).filter((p) => p.active && p.price > 0 && p.images.length > 0).map(publicProduct);
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

// الأكثر طلبا: من الطلبيات الحقيقية (آخر 90 يوم). إذا ما كانش بيانات → null
export async function bestSellerIds(): Promise<string[] | null> {
  try {
    const { dbRpc, dbSelect } = await import("./db");
    const D = 86400_000;
    const from = new Date(Math.floor(Date.now() / D) * D - 90 * D).toISOString();
    const to = new Date(Math.floor(Date.now() / D) * D + D).toISOString();
    const r = await dbRpc<{ product_id: string; orders: number }[]>("dhi_products", { p_from: from, p_to: to }, { revalidate: 3600, tags: ["bestsellers"] });
    if (r) {
      const total = r.reduce((a, x) => a + Number(x.orders), 0);
      return total >= 5 ? r.sort((a, b) => Number(b.orders) - Number(a.orders)).map((x) => x.product_id) : null;
    }
    const rows = await dbSelect<{ product_id: string }>("orders", { select: "product_id", gte: { created_at: from }, limit: 1000 }, { tags: ["bestsellers"] });
    if (rows.length < 5) return null;
    const by = new Map<string, number>();
    for (const x of rows) by.set(x.product_id, (by.get(x.product_id) || 0) + 1);
    return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  } catch {
    return null;
  }
}

// بحث بالعربية (بلا تشكيل، أ/إ/آ = ا، ة = ه، ى = ي)
export function normalizeAr(s: string) {
  return s.toLowerCase().replace(/[ً-ٟـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim();
}

export function searchProducts(list: Product[], q: string) {
  const words = normalizeAr(q).split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter((p) => {
    const hay = normalizeAr([p.name, p.tagline, p.landing?.sub || "", ...(p.landing?.benefits.map((b) => b.title) || []), ...p.description.slice(0, 6)].join(" "));
    return words.every((w) => hay.includes(w));
  });
}

export type SortKey = "featured" | "price-asc" | "price-desc" | "discount";
export function sortProducts(list: Product[], sort: SortKey) {
  const l = [...list];
  if (sort === "price-asc") l.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") l.sort((a, b) => b.price - a.price);
  if (sort === "discount") l.sort((a, b) => discountPercent(b) - discountPercent(a));
  if (sort === "featured") l.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
  return l;
}
