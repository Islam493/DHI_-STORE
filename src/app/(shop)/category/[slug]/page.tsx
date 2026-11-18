import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import { categories, getCategory, productsIn } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() { return categories.map((c) => ({ slug: c.slug })); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = getCategory((await params).slug);
  return c ? { title: c.name, description: `${c.name} بأحسن الأسعار في الجزائر — توصيل لـ 58 ولاية والدفع عند الاستلام.` } : {};
}

export default async function CategoryPage({ params }: Props) {
  const c = getCategory((await params).slug);
  if (!c) notFound();
  const list = await productsIn(c.slug);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-2 text-sm text-muted"><Link href="/" className="hover:text-brand">الرئيسية</Link> / {c.name}</nav>
      <h1 className="mb-6 text-3xl font-extrabold text-navy">{c.icon} {c.name}</h1>
      {list.length ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">{list.map((p) => <ProductCard key={p.slug} p={p} />)}</div>
      ) : (
        <p className="rounded-2xl bg-soft p-8 text-center text-muted">منتجات جديدة جاية قريب 🔜</p>
      )}
    </div>
  );
}
