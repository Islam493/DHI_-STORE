import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import Gallery from "@/components/Gallery";
import OrderForm from "@/components/OrderForm";
import ProductCard from "@/components/ProductCard";
import Trust from "@/components/Trust";
import ViewTracker from "@/components/ViewTracker";
import Reviews, { Stars } from "@/components/Reviews";
import RecentlyViewed from "@/components/RecentlyViewed";
import Faq from "@/components/Faq";
import ContactBlock from "@/components/ContactBlock";
import MotionShowcase from "@/components/MotionShowcase";
import Reveal from "@/components/Reveal";
import packs from "@/data/design-packs.json";
import { discountPercent, getCategory, getProduct, getProducts, isLow, isOut, type Product } from "@/lib/catalog";
import { formatPrice, store } from "@/lib/config";
import { getSettings, getWilayas } from "@/lib/settings";
import { getReviews, summarize } from "@/lib/reviews";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return {};
  const description = (p.landing?.sub || p.description.slice(0, 3).join(" ")).slice(0, 160);
  const url = `/products/${p.slug}`;
  return { title: p.name, description, alternates: { canonical: url }, openGraph: { title: p.name, description, url, images: [p.images[0]] } };
}

const abs = (i: string) => (i.startsWith("http") ? i : `${store.url}${i}`);

// المقارنة: غير المنتجات اللي عندهم مواصفات فنفس القسم
function comparison(p: Product, all: Product[]) {
  const peers = all.filter((x) => x.category === p.category && Object.keys(x.landing?.specs || {}).length >= 2);
  if (!peers.some((x) => x.id === p.id) || peers.length < 2) return null;
  const list = [p, ...peers.filter((x) => x.id !== p.id)].slice(0, 4);
  const keys = [...new Set(list.flatMap((x) => Object.keys(x.landing!.specs)))];
  return { list, keys };
}

export default async function ProductPage({ params }: Props) {
  const p = await getProduct((await params).slug);
  if (!p) notFound();
  const [all, wilayas, settings, productReviews, allReviews] = await Promise.all([getProducts(), getWilayas(), getSettings(), getReviews(p.id), getReviews()]);
  const L = p.landing;
  // التصاميم الجداد فيهم الكتيبة، علاه الموشن ياخذ الصورة الحقيقية
  const pack = (packs as Record<string, { images: string[]; photo: string }>)[p.slug];
  const motionImage = pack && p.images.some((i) => pack.images.includes(i)) ? pack.photo : p.images[1] || p.images[0];
  const off = discountPercent(p);
  const cat = getCategory(p.category);
  const related = all.filter((x) => x.category === p.category && x.slug !== p.slug).slice(0, 4);
  const others = related.length ? related : all.filter((x) => x.slug !== p.slug).slice(0, 4);
  const sum = summarize(productReviews);
  const storeReviews = allReviews.filter((r) => !r.product_id);
  const faqs = [...(L?.faqs || []), ...settings.content.faqs];
  const cmp = comparison(p, all);

  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "Product", name: p.name, image: p.images.map(abs),
      description: (L?.sub || p.description.join(" ")).slice(0, 500), brand: { "@type": "Brand", name: store.name },
      offers: { "@type": "Offer", priceCurrency: "DZD", price: p.price, availability: isOut(p) ? "https://schema.org/OutOfStock" : "https://schema.org/InStock", url: `${store.url}/products/${p.slug}` },
      ...(sum.count ? { aggregateRating: { "@type": "AggregateRating", ratingValue: sum.avg, reviewCount: sum.count } } : {}),
    },
    ...(faqs.length ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
  ];

  return (
    <div className="pb-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ViewTracker id={p.id} name={p.name} value={p.price} />

      {/* 1. الهيرو */}
      <section className="mx-auto max-w-6xl px-4 py-6">
        <nav className="mb-4 text-sm text-muted">
          <Link href="/" className="hover:text-brand">الرئيسية</Link>
          {cat && <> / <Link href={`/category/${cat.slug}`} className="hover:text-brand">{cat.name}</Link></>}
        </nav>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="md:sticky md:top-28 md:self-start"><Gallery images={p.images} alt={p.name} badge={off} /></div>
          <div>
            {cat && <span className="inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">{cat.icon} {cat.name}</span>}
            {L?.headline && <p className="mt-3 text-lg font-extrabold leading-snug text-brand md:text-xl">{L.headline}</p>}
            <h1 className="mt-1 text-2xl font-extrabold leading-snug text-navy md:text-3xl">{p.name}</h1>
            {L?.sub && <p className="mt-2 leading-7 text-muted">{L.sub}</p>}
            {sum.count > 0 && (
              <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-sm"><Stars value={sum.avg} /> <b>{sum.avg.toFixed(1)}</b> <span className="text-muted">({sum.count} رأي)</span></a>
            )}
            <div className="mt-4 flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-extrabold text-brand">{formatPrice(p.price)}</span>
              {off > 0 && <>
                <span className="text-lg text-muted line-through">{formatPrice(p.compareAtPrice!)}</span>
                <span className="rounded-full bg-sale/10 px-3 py-1 text-sm font-bold text-sale">وفّر {formatPrice(p.compareAtPrice! - p.price)}</span>
              </>}
            </div>
            {L?.benefits?.length ? (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {L.benefits.slice(0, 4).map((b) => <li key={b.title} className="flex items-center gap-2 rounded-xl bg-soft px-3 py-2 text-sm font-bold text-navy"><span>{b.icon}</span>{b.title}</li>)}
              </ul>
            ) : null}
            {isLow(p) && <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">⚠️ باقي {p.stock} برك فالمخزون</p>}
            <div className="my-6">
              {isOut(p) ? (
                <div id="order" className="scroll-mt-28 rounded-3xl border-2 border-sale/30 bg-sale/5 p-5 text-center">
                  <p className="text-3xl">⛔</p>
                  <p className="mt-2 text-lg font-extrabold text-navy">نفذ المخزون حاليا</p>
                  <p className="mt-1 text-sm text-muted">راسلنا ونقولولك وقتاش يرجع، ولا نعاونوك تختار منتج آخر.</p>
                  <div className="mt-4"><ContactBlock socials={false} compact /></div>
                </div>
              ) : <OrderForm product={p} wilayas={wilayas} />}
            </div>
            <Trust compact />
          </div>
        </div>
      </section>

      {/* 2. المشكل */}
      {L?.problem.points.length ? (
        <section className="mt-10 bg-soft py-14">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <Reveal><h2 className="text-2xl font-extrabold text-navy md:text-3xl">{L.problem.title}</h2></Reveal>
            <ul className="mx-auto mt-8 grid max-w-3xl gap-3 text-right md:grid-cols-3">
              {L.problem.points.map((pt, k) => <Reveal key={pt} delay={k * 120}><li className="h-full rounded-2xl bg-white p-4 leading-7 text-navy shadow-sm ring-1 ring-line">😟 {pt}</li></Reveal>)}
            </ul>
          </div>
        </section>
      ) : null}

      {/* القصة: الزبون يتخيّل روحو */}
      {L?.story && (
        <section className="mx-auto max-w-3xl px-4 py-14 text-center">
          <Reveal>
            <p className="text-4xl">❤️</p>
            <p className="mt-4 text-xl font-bold leading-[2.1] text-navy md:text-2xl md:leading-[2.1]">{L.story}</p>
          </Reveal>
        </section>
      )}

      {/* 3. الحل — موشن جرافيك بصورة المنتج الحقيقية */}
      {L?.benefits.length ? (
        <MotionShowcase image={motionImage} name={p.name} headline={`كيفاش ${p.name.split("–")[0].trim()} يريّحلك بالك؟`} benefits={L.benefits} scan={p.category.startsWith("cameras") || p.category === "hidden"} />
      ) : null}

      {/* 4. المميزات */}
      {L?.benefits.length ? (
        <section className="py-14">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="mb-3 text-center text-2xl font-extrabold text-navy md:text-3xl">علاش تختار {p.name.split("–")[0].trim()}؟</h2>
            {L.uses.length > 0 && <p className="mb-8 text-center text-sm text-muted">📍 تنفعك ل: {L.uses.join(" · ")}</p>}
            <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
              {L.benefits.map((b, k) => (
                <Reveal key={b.title} delay={(k % 3) * 100}>
                <div className="h-full rounded-3xl bg-white p-4 shadow-sm ring-1 ring-line transition hover:-translate-y-1 hover:shadow-lg md:p-6">
                  <span className="grid size-10 place-items-center rounded-2xl bg-brand/10 text-xl md:size-12 md:text-2xl">{b.icon}</span>
                  <h3 className="mt-3 font-extrabold text-navy md:mt-4 md:text-lg">{b.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted md:text-base md:leading-7">{b.text}</p>
                </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-14">
        {/* 5. الصور */}
        {p.images.length > 1 && (
          <section>
            <h2 className="mb-4 text-2xl font-extrabold text-navy">📸 شوف المنتج من قريب</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {p.images.map((src, i) => (
                <div key={src} className="relative aspect-square overflow-hidden rounded-2xl bg-soft ring-1 ring-line">
                  <Image src={src} alt={`${p.name} — صورة ${i + 1}`} fill sizes="(max-width:768px) 50vw, 33vw" className="object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 6. الآراء */}
        <Reviews reviews={productReviews.length ? productReviews : storeReviews} title={productReviews.length ? "آراء الزبائن على هاد المنتج" : "آراء زبائن DHI Electronics"} />

        {/* 7. الثقة */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 ring-1 ring-line">
            <p className="text-2xl">🚚</p><h3 className="mt-2 font-extrabold text-navy">التوصيل</h3>
            <ul className="mt-2 space-y-1 text-sm leading-6 text-muted">{settings.content.delivery.slice(0, 3).map((l) => <li key={l}>• {l}</li>)}</ul>
            <Link href="/policies/shipping" className="mt-2 inline-block text-sm font-bold text-brand">أسعار التوصيل ←</Link>
          </div>
          <div className="rounded-3xl bg-white p-5 ring-1 ring-line">
            <p className="text-2xl">🔄</p><h3 className="mt-2 font-extrabold text-navy">الإرجاع{settings.content.warranty ? " والضمان" : ""}</h3>
            <ul className="mt-2 space-y-1 text-sm leading-6 text-muted">
              {settings.content.returns.slice(0, 2).map((l) => <li key={l}>• {l}</li>)}
              {settings.content.warranty && <li>• 🛡️ {settings.content.warranty}</li>}
            </ul>
            <Link href="/policies/returns" className="mt-2 inline-block text-sm font-bold text-brand">التفاصيل ←</Link>
          </div>
          <div className="rounded-3xl bg-white p-5 ring-1 ring-line">
            <p className="text-2xl">💬</p><h3 className="mt-2 font-extrabold text-navy">عندك سؤال؟</h3>
            <p className="mt-2 text-sm leading-6 text-muted">فريق DHI Electronics يجاوبك قبل وبعد الطلب.</p>
            <div className="mt-3"><ContactBlock socials={false} compact /></div>
          </div>
        </section>

        {/* 8. قبل ما تطلب + الأسئلة */}
        {(L?.notes.length || faqs.length) ? (
          <section className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            {L?.notes.length ? (
              <div className="h-fit rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-200">
                <h2 className="font-extrabold text-amber-900">📌 قبل ما تطلب</h2>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-amber-900">{L.notes.map((n) => <li key={n}>• {n}</li>)}</ul>
              </div>
            ) : <div className="hidden lg:block" />}
            <div>
              <h2 className="mb-4 text-2xl font-extrabold text-navy">❓ أسئلة متكررة</h2>
              <Faq items={faqs} />
            </div>
          </section>
        ) : null}

        {/* 9. المقارنة */}
        {cmp && (
          <section>
            <h2 className="mb-4 text-2xl font-extrabold text-navy">⚖️ قارن واختار</h2>
            <div className="overflow-x-auto rounded-3xl bg-white ring-1 ring-line">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="p-3 text-right text-muted">الخاصية</th>
                    {cmp.list.map((x) => (
                      <th key={x.id} className={`p-3 text-center ${x.id === p.id ? "bg-brand/5" : ""}`}>
                        <Link href={`/products/${x.slug}`} className="font-extrabold text-navy hover:text-brand">{x.name}</Link>
                        {x.id === p.id && <span className="mt-1 block text-xs text-brand">(هادي)</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {cmp.keys.map((k) => (
                    <tr key={k}>
                      <td className="p-3 font-bold text-muted">{k}</td>
                      {cmp.list.map((x) => <td key={x.id} className={`p-3 text-center ${x.id === p.id ? "bg-brand/5 font-bold" : ""}`}>{x.landing!.specs[k] || "—"}</td>)}
                    </tr>
                  ))}
                  <tr>
                    <td className="p-3 font-bold text-muted">السعر</td>
                    {cmp.list.map((x) => <td key={x.id} className={`p-3 text-center font-extrabold text-brand ${x.id === p.id ? "bg-brand/5" : ""}`}>{formatPrice(x.price)}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">«—» معناها المعلومة ماشي محددة فوصف المنتج.</p>
          </section>
        )}

        {/* 10. كل التفاصيل */}
        {p.description.length > 0 && (
          <details className="rounded-3xl border border-line bg-white p-5">
            <summary className="cursor-pointer text-lg font-extrabold text-navy">📄 كل تفاصيل المنتج</summary>
            <div className="mt-4 space-y-2 leading-8">{p.description.map((l, i) => <p key={i}>{l}</p>)}</div>
          </details>
        )}

        {/* 11. آخر دعوة */}
        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-l from-navy to-navy-2 p-6 text-white md:p-10">
          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
            <div>
              {L?.promise && <p className="text-2xl font-extrabold leading-snug md:text-3xl">{L.promise}</p>}
              <p className={`${L?.promise ? "mt-2 text-lg font-bold text-white/85" : "text-2xl font-extrabold md:text-3xl"}`}>{p.name}</p>
              <p className="mt-2 text-white/75">💵 الدفع عند الاستلام · 🚚 توصيل لـ 58 ولاية · 📞 نتصلو بيك نأكدو قبل ما نبعثو</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-extrabold">{formatPrice(p.price)}</p>
              {off > 0 && <p className="text-sm text-white/60 line-through">{formatPrice(p.compareAtPrice!)}</p>}
              <a href="#order" className="cta-pulse mt-3 inline-block rounded-2xl bg-brand px-8 py-4 text-lg font-extrabold">{isOut(p) ? "تواصل معنا" : "اطلب الآن"}</a>
            </div>
          </div>
        </section>

        {others.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-extrabold text-navy">{related.length ? "منتجات مشابهة" : "منتجات أخرى"}</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">{others.map((r) => <ProductCard key={r.slug} p={r} />)}</div>
          </section>
        )}
        <RecentlyViewed current={p.slug} all={all.map((x) => ({ slug: x.slug, name: x.name, image: x.images[0], price: x.price }))} />
      </div>

      {/* 12. شريط الشراء: ديما ظاهر من الدخول حتى الأخير (تيليفون وكمبيوتر) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 p-3 backdrop-blur md:inset-x-auto md:bottom-5 md:left-1/2 md:w-[34rem] md:-translate-x-1/2 md:rounded-3xl md:border md:shadow-2xl">
        <a href="#order" className="cta-nudge cta-shine flex items-center justify-between rounded-2xl bg-brand px-5 py-3 font-extrabold text-white shadow-lg shadow-brand/30 md:py-3.5 md:text-lg">
          <span className="leading-tight">{isOut(p) ? "نفذ المخزون" : "اطلب الآن"}<span className="block text-[11px] font-semibold opacity-80">{isOut(p) ? "راسلنا على الواتساب" : "💵 الدفع عند الاستلام"}</span></span>
          <span className="text-left">{formatPrice(p.price)}{off > 0 && <span className="block text-[11px] font-semibold line-through opacity-70">{formatPrice(p.compareAtPrice!)}</span>}</span>
        </a>
      </div>
    </div>
  );
}
