import Link from "next/link";
import Image from "next/image";
import ProductCard from "@/components/ProductCard";
import Trust from "@/components/Trust";
import { categories, getProducts } from "@/lib/catalog";

const faqs = [
  ["كيفاش نخلص؟", "تخلص كي توصلك السلعة (الدفع عند الاستلام). ما تخلص حتى دورو قبل."],
  ["شحال يدي التوصيل؟", "عادة من 24 لـ 72 ساعة حسب الولاية. الولايات البعيدة تقدر تدي شوية أكثر."],
  ["كاميرات 4G تخدم بأي شريحة؟", "إيه، تخدم بـ Mobilis و Djezzy و Ooredoo. تحط فيها شريحة فيها أنترنت وخلاص."],
  ["إذا ما عرفتش نركّبها؟", "نبعثولك فيديو الشرح، وإذا حبيت نعاونوك على الواتساب حتى تخدم."],
  ["إذا جاتني فيها مشكلة؟", "إذا كان عيب مصنع نبدلوهالك. شوف صفحة الإرجاع والاستبدال."],
];

export default async function Home() {
  const products = await getProducts();
  const hero = products.find((p) => p.slug === "bulb-camera-360") ?? products[0];
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-bl from-navy via-navy-2 to-navy text-white">
        <div className="absolute -left-24 -top-24 size-96 rounded-full bg-brand/30 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:py-20">
          <div>
            <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">🔒 راحة بالك تبدأ من هنا</span>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight md:text-5xl">احمي دارك ورزقك<br /><span className="text-brand">وين ما كنت</span></h1>
            <p className="mt-4 max-w-md text-lg leading-8 text-white/80">كاميرات مراقبة ذكية تخدم بالـ WiFi ولا بالـ 4G والطاقة الشمسية. شوف كلشي من تيليفونك، نهار وليل.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="#products" className="rounded-2xl bg-brand px-6 py-3.5 font-extrabold hover:bg-brand-dark">تسوّق الآن</Link>
              <Link href="/category/cameras-4g" className="rounded-2xl bg-white/10 px-6 py-3.5 font-bold hover:bg-white/20">كاميرات بلا كهرباء ☀️</Link>
            </div>
            <div className="mt-8 flex gap-6 text-sm text-white/70">
              <span>✅ الدفع عند الاستلام</span><span>✅ 58 ولاية</span><span>✅ ضمان</span>
            </div>
          </div>
          {hero && <Link href={`/products/${hero.slug}`} className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-[2rem] ring-8 ring-white/10">
            <Image src={hero.images[0]} alt={hero.name} fill priority sizes="(max-width:768px) 100vw, 450px" className="object-cover" />
          </Link>}
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-6 max-w-6xl px-4"><Trust /></section>

      <section className="mx-auto mt-12 max-w-6xl px-4">
        <h2 className="mb-4 text-2xl font-extrabold text-navy">تسوّق حسب القسم</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {categories.map((c) => (
            <Link key={c.slug} href={`/category/${c.slug}`} className="rounded-2xl border border-line bg-soft p-4 text-center transition hover:border-brand hover:bg-white">
              <span className="text-3xl">{c.icon}</span>
              <p className="mt-2 text-sm font-extrabold text-navy">{c.name}</p>
              <p className="text-xs text-muted">{products.filter((p) => p.category === c.slug).length} منتج</p>
            </Link>
          ))}
        </div>
      </section>

      <section id="products" className="mx-auto mt-12 max-w-6xl scroll-mt-28 px-4">
        <h2 className="mb-4 text-2xl font-extrabold text-navy">كل المنتجات</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {products.map((p, i) => <ProductCard key={p.slug} p={p} priority={i < 4} />)}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-3xl px-4">
        <h2 className="mb-4 text-center text-2xl font-extrabold text-navy">أسئلة متكررة</h2>
        <div className="space-y-3">
          {faqs.map(([q, a]) => (
            <details key={q} className="group rounded-2xl border border-line bg-white p-4 open:bg-soft">
              <summary className="cursor-pointer list-none font-bold text-navy">{q}<span className="float-left transition group-open:rotate-45">+</span></summary>
              <p className="mt-2 leading-7 text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
