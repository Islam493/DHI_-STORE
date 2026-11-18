import Link from "next/link";
import ProductCard from "./ProductCard";
import { categories } from "@/lib/categories";
import type { Product, SortKey } from "@/lib/catalog";

const sorts: [SortKey, string][] = [["featured", "المميزة"], ["price-asc", "الأرخص"], ["price-desc", "الأغلى"], ["discount", "أكبر تخفيض"]];

// شبكة المنتجات مع الأقسام والترتيب (تخدم بلا JavaScript)
export default function ProductGrid({ products, base, q, cat, sort }: { products: Product[]; base: string; q?: string; cat?: string; sort: SortKey }) {
  const url = (p: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries({ q, cat, sort, ...p }).filter(([, v]) => v && v !== "featured") as [string, string][]);
    const str = s.toString();
    return str ? `${base}?${str}` : base;
  };
  return (
    <div>
      {base === "/search" && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          <Link href={url({ cat: undefined })} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ring-1 ${!cat ? "bg-navy text-white ring-navy" : "bg-white ring-line"}`}>الكل</Link>
          {categories.map((c) => (
            <Link key={c.slug} href={url({ cat: c.slug })} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ring-1 ${cat === c.slug ? "bg-navy text-white ring-navy" : "bg-white ring-line"}`}>{c.icon} {c.short}</Link>
          ))}
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{products.length} منتج</p>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {sorts.map(([k, label]) => (
            <Link key={k} href={url({ sort: k })} className={`rounded-full px-3 py-1.5 font-bold ring-1 ${sort === k ? "bg-brand text-white ring-brand" : "bg-white text-muted ring-line"}`}>{label}</Link>
          ))}
        </div>
      </div>
      {products.length ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">{products.map((p, i) => <ProductCard key={p.slug} p={p} priority={i < 4} />)}</div>
      ) : (
        <div className="rounded-3xl bg-soft p-10 text-center">
          <p className="text-4xl">🔍</p>
          <p className="mt-2 font-bold text-navy">ما لقينا حتى منتج{q ? ` بـ «${q}»` : ""}</p>
          <Link href="/search" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white">شوف كل المنتجات</Link>
        </div>
      )}
    </div>
  );
}
