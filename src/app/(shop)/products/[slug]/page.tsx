import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Gallery from "@/components/Gallery";
import OrderForm from "@/components/OrderForm";
import ProductCard from "@/components/ProductCard";
import Trust from "@/components/Trust";
import ViewTracker from "@/components/ViewTracker";
import { discountPercent, getCategory, getProduct, getProducts, productsIn } from "@/lib/catalog";
import { formatPrice, store } from "@/lib/config";
import { getWilayas } from "@/lib/settings";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return {};
  const description = p.description.slice(0, 3).join(" ").slice(0, 160);
  return { title: p.name, description, openGraph: { title: p.name, description, images: [p.images[0]] } };
}

export default async function ProductPage({ params }: Props) {
  const p = await getProduct((await params).slug);
  if (!p) notFound();
  const off = discountPercent(p);
  const cat = getCategory(p.category);
  const related = (await productsIn(p.category)).filter((x) => x.slug !== p.slug).slice(0, 4);
  const wilayas = await getWilayas();

  const jsonLd = {
    "@context": "https://schema.org", "@type": "Product", name: p.name,
    image: p.images.map((i) => (i.startsWith("http") ? i : `${store.url}${i}`)), description: p.description.join(" ").slice(0, 500),
    brand: { "@type": "Brand", name: store.name },
    offers: { "@type": "Offer", priceCurrency: "DZD", price: p.price, availability: "https://schema.org/InStock", url: `${store.url}/products/${p.slug}` },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-28 md:pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ViewTracker id={p.id} name={p.name} value={p.price} />
      <nav className="mb-4 text-sm text-muted">
        <Link href="/" className="hover:text-brand">الرئيسية</Link>
        {cat && <> / <Link href={`/category/${cat.slug}`} className="hover:text-brand">{cat.name}</Link></>}
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="md:sticky md:top-28 md:self-start"><Gallery images={p.images} alt={p.name} badge={off} /></div>
        <div>
          <p className="mb-2 text-sm font-bold text-brand">{p.tagline !== p.name ? p.tagline : cat?.name}</p>
          <h1 className="text-2xl font-extrabold leading-snug text-navy md:text-3xl">{p.name}</h1>
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-extrabold text-brand">{formatPrice(p.price)}</span>
            {off > 0 && <>
              <span className="text-lg text-muted line-through">{formatPrice(p.compareAtPrice!)}</span>
              <span className="rounded-full bg-sale/10 px-3 py-1 text-sm font-bold text-sale">وفّر {formatPrice(p.compareAtPrice! - p.price)}</span>
            </>}
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-ok"><span className="size-2 rounded-full bg-ok" /> متوفر — يتبعث فـ 24 ساعة</p>

          <div className="my-6"><OrderForm product={p} wilayas={wilayas} /></div>
          <Trust compact />
        </div>
      </div>

      {p.description.length > 0 && (
        <section className="mx-auto mt-12 max-w-3xl">
          <h2 className="mb-4 text-xl font-extrabold text-navy">تفاصيل المنتج</h2>
          <div className="space-y-2 rounded-3xl border border-line bg-white p-5 leading-8 md:p-8">
            {p.description.map((l, i) => <p key={i}>{l}</p>)}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-extrabold text-navy">منتجات مشابهة</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">{related.map((r) => <ProductCard key={r.slug} p={r} />)}</div>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 p-3 backdrop-blur md:hidden">
        <a href="#order" className="flex items-center justify-between rounded-2xl bg-brand px-5 py-3.5 font-extrabold text-white">
          <span>اطلب الآن</span><span>{formatPrice(p.price)}</span>
        </a>
      </div>
    </div>
  );
}
