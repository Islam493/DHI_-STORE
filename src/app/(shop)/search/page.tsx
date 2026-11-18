import type { Metadata } from "next";
import ProductGrid from "@/components/ProductGrid";
import { getCategory, getProducts, searchProducts, sortProducts, type SortKey } from "@/lib/catalog";

type Props = { searchParams: Promise<{ q?: string; cat?: string; sort?: string }> };

export const metadata: Metadata = { title: "كل المنتجات", description: "كاميرات المراقبة وأجهزة الأمان الذكية — DHI Electronics", alternates: { canonical: "/search" } };

export default async function Search({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q || "").slice(0, 60);
  const cat = getCategory(sp.cat || "")?.slug;
  const sort = (["featured", "price-asc", "price-desc", "discount"].includes(sp.sort || "") ? sp.sort : "featured") as SortKey;
  let list = await getProducts();
  if (cat) list = list.filter((p) => p.category === cat);
  list = sortProducts(searchProducts(list, q), sort);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-4 text-3xl font-extrabold text-navy">{q ? `نتائج البحث: «${q}»` : "كل المنتجات"}</h1>
      <form action="/search" className="mb-5 flex gap-2">
        {cat && <input type="hidden" name="cat" value={cat} />}
        <input name="q" defaultValue={q} placeholder="🔍 قلّب: كاميرا 4G، رؤية ليلية، شمسية..." className="flex-1 rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/15" />
        <button className="rounded-2xl bg-brand px-5 font-bold text-white">بحث</button>
      </form>
      <ProductGrid products={list} base="/search" q={q || undefined} cat={cat} sort={sort} />
    </div>
  );
}
