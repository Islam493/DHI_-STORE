import Link from "next/link";
import Image from "next/image";
import ProductCard from "@/components/ProductCard";
import Trust from "@/components/Trust";
import Reviews from "@/components/Reviews";
import Faq from "@/components/Faq";
import { socialMeta } from "@/components/SocialIcons";
import { bestSellerIds, categories, discountPercent, getProducts } from "@/lib/catalog";
import { formatPrice } from "@/lib/config";
import { getSettings, waLink } from "@/lib/settings";
import { getReviews, summarize } from "@/lib/reviews";

export const revalidate = 3600;

export default async function Home() {
  const [products, settings, reviews, best] = await Promise.all([getProducts(), getSettings(), getReviews(), bestSellerIds()]);
  const c = settings.content;
  const rank = (id: string) => { const i = best?.indexOf(id) ?? -1; return i < 0 ? 999 : i; };
  const featured = best
    ? [...products].sort((a, b) => rank(a.id) - rank(b.id)).slice(0, 8)
    : [...products].sort((a, b) => Number(!!b.featured) - Number(!!a.featured)).slice(0, 8);
  const offers = products.filter((p) => discountPercent(p) > 0).sort((a, b) => discountPercent(b) - discountPercent(a)).slice(0, 4);
  const heroMain = products.find((p) => p.slug === "solar-4g-camera") ?? products[0];
  const heroSide = products.filter((p) => p.id !== heroMain?.id && p.category !== heroMain?.category).slice(0, 2);
  const rs = summarize(reviews);
  const wa = waLink(settings.whatsapp, "السلام عليكم، نحب نسقسي على منتج");

  // أرقام حقيقية برك: إذا ما كانش رقم، ما يبانش
  const stats = [
    c.successOrders ? [`+${c.successOrders.toLocaleString("en-US")}`, "طلبية ناجحة"] : null,
    ["58", "ولاية نوصلولها"],
    rs.count ? [`${rs.avg.toFixed(1)} ★`, `من ${rs.count} رأي`] : null,
    [`${products.length}`, "منتج مختار"],
  ].filter(Boolean) as [string, string][];

  return (
    <>
      {/* الهيرو */}
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_15%_20%,rgba(47,128,237,.35),transparent_60%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1.1fr_1fr] md:py-20">
          <div>
            {c.successOrders ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold ring-1 ring-white/15">✅ +{c.successOrders.toLocaleString("en-US")} طلبية ناجحة عبر الجزائر</span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold ring-1 ring-white/15">🔒 أنظمة المراقبة والحماية الذكية</span>
            )}
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.25] md:text-6xl">حماية ذكية<br />لدارك ورزقك<span className="text-brand">.</span></h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-white/75">كاميرات مراقبة WiFi و 4G بالطاقة الشمسية وأجهزة أمان ذكية. تراقب كلشي من تيليفونك، وتخلص كي توصلك.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="#best" className="rounded-2xl bg-brand px-7 py-4 font-extrabold shadow-lg shadow-brand/30 transition hover:bg-brand-dark">تسوّق الآن</Link>
              <Link href="/category/cameras-4g" className="rounded-2xl bg-white/10 px-6 py-4 font-bold ring-1 ring-white/15 transition hover:bg-white/15">☀️ كاميرات بلا كهرباء</Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
              <li>💵 الدفع عند الاستلام</li><li>🚚 58 ولاية</li><li>📞 تأكيد بالهاتف</li>
            </ul>
          </div>
          {heroMain && (
            <div className="relative mx-auto w-full max-w-md">
              <Link href={`/products/${heroMain.slug}`} className="relative block aspect-square overflow-hidden rounded-[2.5rem] bg-white shadow-2xl ring-8 ring-white/5">
                <Image src={heroMain.images[0]} alt={heroMain.name} fill priority sizes="(max-width:768px) 90vw, 450px" className="object-cover" />
              </Link>
              <div className="relative -mt-8 grid grid-cols-2 gap-3 px-4">
                {heroSide.map((p) => (
                  <Link key={p.id} href={`/products/${p.slug}`} className="flex items-center gap-2 rounded-2xl bg-white p-2 text-navy shadow-xl transition hover:-translate-y-0.5">
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-soft"><Image src={p.images[0]} alt="" fill sizes="48px" className="object-cover" /></span>
                    <span className="min-w-0"><span className="line-clamp-1 text-xs font-bold">{p.name}</span><span className="text-xs font-extrabold text-brand">{formatPrice(p.price)}</span></span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* الأرقام */}
      <section className="relative z-10 mx-auto -mt-8 max-w-5xl px-4">
        <div className={`grid grid-cols-2 gap-3 rounded-3xl bg-white p-4 shadow-xl ring-1 ring-line ${({ 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" } as Record<number, string>)[stats.length] || ""}`}>
          {stats.map(([n, l]) => (
            <div key={l} className="text-center"><p className="text-2xl font-extrabold text-navy md:text-3xl" dir="ltr">{n}</p><p className="text-xs font-bold text-muted md:text-sm">{l}</p></div>
          ))}
        </div>
      </section>

      {/* الأقسام */}
      <section className="mx-auto mt-14 max-w-6xl px-4">
        <div className="mb-5 flex items-end justify-between"><h2 className="text-2xl font-extrabold text-navy md:text-3xl">تسوّق حسب احتياجك</h2></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {categories.map((cat) => {
            const list = products.filter((p) => p.category === cat.slug);
            if (!list.length) return null;
            return (
              <Link key={cat.slug} href={`/category/${cat.slug}`} className="group overflow-hidden rounded-3xl bg-white ring-1 ring-line transition hover:-translate-y-1 hover:shadow-lg hover:ring-brand">
                <div className="relative aspect-[4/3] bg-soft"><Image src={list[0].images[0]} alt={cat.name} fill sizes="(max-width:768px) 50vw, 20vw" className="object-cover transition duration-500 group-hover:scale-105" /></div>
                <div className="p-3"><p className="text-sm font-extrabold text-navy">{cat.icon} {cat.name}</p><p className="text-xs text-muted">{list.length} منتج</p></div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* الأكثر طلبا */}
      <section id="best" className="mx-auto mt-14 max-w-6xl scroll-mt-28 px-4">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-extrabold text-navy md:text-3xl">{best ? "🔥 الأكثر طلبا" : "⭐ منتجاتنا المختارة"}</h2>
          <Link href="/search" className="text-sm font-bold text-brand">شوف الكل ←</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">{featured.map((p, i) => <ProductCard key={p.slug} p={p} priority={i < 4} />)}</div>
      </section>

      {/* علاش DHI */}
      <section className="mt-16 bg-soft py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-2 text-center text-2xl font-extrabold text-navy md:text-3xl">علاش الزبائن يختارو DHI Electronics؟</h2>
          <p className="mb-8 text-center text-muted">نخدمو باش تكون الشرية ساهلة وبلا خوف</p>
          <Trust />
        </div>
      </section>

      {/* كيفاش تطلب */}
      <section className="mx-auto mt-14 max-w-6xl px-4">
        <h2 className="mb-8 text-center text-2xl font-extrabold text-navy md:text-3xl">كيفاش تطلب؟ ساهلة 👌</h2>
        <ol className="grid gap-4 md:grid-cols-4">
          {[["🛍️", "اختار المنتج", "شوف التفاصيل والصور"], ["📝", "عمّر الفورم", "الاسم، الهاتف والولاية برك"], ["📞", "نتصلو بيك", "نأكدو الطلبية والعنوان"], ["📦", "تستلم وتخلص", "الدفع عند الاستلام"]].map(([i, t, d], k) => (
            <li key={t} className="relative rounded-3xl bg-white p-6 text-center ring-1 ring-line">
              <span className="absolute right-4 top-4 grid size-7 place-items-center rounded-full bg-brand text-xs font-extrabold text-white">{k + 1}</span>
              <p className="text-4xl">{i}</p><p className="mt-3 font-extrabold text-navy">{t}</p><p className="text-sm text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* العروض */}
      {offers.length > 0 && (
        <section className="mx-auto mt-14 max-w-6xl px-4">
          <div className="rounded-[2rem] bg-gradient-to-l from-brand/10 to-white p-5 ring-1 ring-brand/20 md:p-8">
            <h2 className="mb-5 text-2xl font-extrabold text-navy md:text-3xl">🏷️ عروض بأسعار مخفضة</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">{offers.map((p) => <ProductCard key={p.slug} p={p} />)}</div>
          </div>
        </section>
      )}

      {/* الآراء */}
      {reviews.length > 0 && <div className="mx-auto mt-14 max-w-6xl px-4"><Reviews reviews={reviews} title="آراء زبائننا" /></div>}

      {/* الأسئلة */}
      {c.faqs.length > 0 && (
        <section className="mx-auto mt-14 max-w-3xl px-4">
          <h2 className="mb-5 text-center text-2xl font-extrabold text-navy md:text-3xl">❓ أسئلة متكررة</h2>
          <Faq items={c.faqs} />
        </section>
      )}

      {/* السوشيال */}
      <section className="mx-auto mt-14 max-w-6xl px-4">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-navy md:text-3xl">تابع DHI Electronics على مواقع التواصل الاجتماعي</h2>
          <p className="mt-2 text-muted">ابقى على اتصال معنا، واكتشف آخر منتجاتنا وعروضنا وجديدنا.</p>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {socialMeta.map(({ k, name, handle, Icon, color }) => c.socials[k] && (
            <a key={k} href={c.socials[k]} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 rounded-3xl bg-white p-5 ring-1 ring-line transition hover:-translate-y-1 hover:shadow-lg">
              <span className={`grid size-14 shrink-0 place-items-center rounded-2xl text-white ${color}`}><Icon className="size-7" /></span>
              <span><span className="block text-lg font-extrabold text-navy">{name}</span><span className="text-sm font-bold text-brand group-hover:underline" dir="ltr">{handle}</span></span>
            </a>
          ))}
        </div>
      </section>

      {/* آخر دعوة */}
      <section className="mx-auto mt-14 max-w-6xl px-4">
        <div className="relative overflow-hidden rounded-[2rem] bg-navy p-8 text-center text-white md:p-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_70%_at_80%_10%,rgba(47,128,237,.35),transparent_60%)]" />
          <div className="relative">
            <Image src="/logo.png" alt="" width={72} height={72} className="mx-auto rounded-full bg-white" />
            <h2 className="mt-4 text-2xl font-extrabold md:text-4xl">راحة بالك تبدأ اليوم</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/75">اختار الكاميرا المناسبة لدارك ولا رزقك، وفريقنا يعاونك تختار إذا حتاريت.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/search" className="rounded-2xl bg-brand px-7 py-4 font-extrabold">شوف كل المنتجات</Link>
              {wa && <a href={wa} target="_blank" rel="noopener" className="rounded-2xl bg-wa px-6 py-4 font-bold">💬 سقسينا على الواتساب</a>}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
