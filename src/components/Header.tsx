import Link from "next/link";
import Logo from "./Logo";
import { categories } from "@/lib/catalog";

const perks = ["💵 الدفع عند الاستلام", "🚚 توصيل لـ 58 ولاية", "🛡️ ضمان على كل المنتجات", "📞 خدمة زبائن قبل وبعد الشراء"];

export default function Header() {
  return (
    <header className="sticky top-0 z-40">
      <div className="overflow-hidden bg-navy py-2 text-[13px] font-semibold text-white">
        <div className="marquee flex w-max gap-10 whitespace-nowrap">
          {[...perks, ...perks, ...perks, ...perks].map((p, i) => <span key={i}>{p}</span>)}
        </div>
      </div>
      <div className="border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" aria-label="الرئيسية"><Logo /></Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-muted md:flex">
            <Link href="/" className="hover:text-brand">الرئيسية</Link>
            {categories.slice(0, 4).map((c) => (
              <Link key={c.slug} href={`/category/${c.slug}`} className="hover:text-brand">{c.short}</Link>
            ))}
            <Link href="/contact" className="hover:text-brand">اتصل بنا</Link>
          </nav>
          <Link href="/#products" className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark">تسوّق الآن</Link>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-3 text-sm md:hidden">
          {categories.map((c) => (
            <Link key={c.slug} href={`/category/${c.slug}`} className="shrink-0 rounded-full border border-line bg-soft px-3 py-1.5 font-semibold text-navy">
              {c.icon} {c.short}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
