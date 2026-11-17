import type { MetadataRoute } from "next";
import { categories, getProducts } from "@/lib/catalog";
import { store } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: store.url, priority: 1 },
    ...categories.map((c) => ({ url: `${store.url}/category/${c.slug}`, priority: 0.8 })),
    ...getProducts().map((p) => ({ url: `${store.url}/products/${p.slug}`, priority: 0.9 })),
    { url: `${store.url}/policies/shipping` }, { url: `${store.url}/policies/returns` }, { url: `${store.url}/contact` },
  ];
}
