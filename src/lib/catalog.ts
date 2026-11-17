import data from "@/data/products.json";

export type Product = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  active: boolean;
  price: number;
  compareAtPrice: number | null;
  variants: { name: string; price: number }[];
  images: string[];
  description: string[];
};

export const categories = [
  { slug: "cameras-4g", name: "كاميرات 4G والطاقة الشمسية", short: "4G وشمسية", icon: "☀️" },
  { slug: "cameras-wifi", name: "كاميرات WiFi", short: "WiFi", icon: "📶" },
  { slug: "hidden", name: "كاميرات سرية", short: "سرية", icon: "🕵️" },
  { slug: "home-security", name: "أمان الدار", short: "أمان الدار", icon: "🏠" },
  { slug: "gadgets", name: "أجهزة ذكية", short: "أجهزة ذكية", icon: "🔍" },
] as const;

const all = data as Product[];

export function getProducts() {
  return all.filter((p) => p.active && p.price > 0);
}

export function getProduct(slug: string) {
  return getProducts().find((p) => p.slug === slug);
}

export function getCategory(slug: string) {
  return categories.find((c) => c.slug === slug);
}

export function productsIn(category: string) {
  return getProducts().filter((p) => p.category === category);
}

export function discountPercent(p: { price: number; compareAtPrice: number | null }) {
  if (!p.compareAtPrice || p.compareAtPrice <= p.price) return 0;
  return Math.round((1 - p.price / p.compareAtPrice) * 100);
}
