import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductGrid from "@/components/ProductGrid";
import { categories, getCategory, productsIn, sortProducts, type SortKey } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string }> };

export function generateStaticParams() { return categories.map((c) => ({ slug: c.slug })); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = getCategory((await params).slug);
  return c ? { title: c.name, description: `${c.name} فالجزائر — توصيل لـ 58 ولاية والدفع عند الاستلام.`, alternates: { canonical: `/category/${c.slug}` } } : {};
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const c = getCategory((await params).slug);
  if (!c) notFound();
  const sp = await searchParams;
  const sort = (["featured", "price-asc", "price-desc", "discount"].includes(sp.sort || "") ? sp.sort : "featured") as SortKey;
  const list = sortProducts(await productsIn(c.slug), sort);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-2 text-sm text-muted"><Link href="/" className="hover:text-brand">الرئيسية</Link> / {c.name}</nav>
      <h1 className="mb-6 text-3xl font-extrabold text-navy">{c.icon} {c.name}</h1>
      <ProductGrid products={list} base={`/category/${c.slug}`} sort={sort} />
    </div>
  );
}
