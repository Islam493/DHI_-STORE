import Link from "next/link";
import Logo from "./Logo";
import ContactBlock from "./ContactBlock";
import { categories } from "@/lib/categories";
import { store } from "@/lib/config";

export default function Footer() {
  return (
    <footer className="mt-16 bg-navy text-white/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-7">{store.tagline}</p>
          <div className="mt-5"><ContactBlock dark compact /></div>
        </div>
        <div>
          <h3 className="mb-3 font-bold text-white">الأقسام</h3>
          <ul className="space-y-2 text-sm">
            {categories.map((c) => <li key={c.slug}><Link href={`/category/${c.slug}`} className="hover:text-white">{c.name}</Link></li>)}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-bold text-white">معلومات</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/search" className="hover:text-white">كل المنتجات</Link></li>
            <li><Link href="/policies/shipping" className="hover:text-white">التوصيل والأسعار</Link></li>
            <li><Link href="/policies/returns" className="hover:text-white">الإرجاع والاستبدال</Link></li>
            <li><Link href="/contact" className="hover:text-white">اتصل بنا</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs">© {new Date().getFullYear()} {store.name} — جميع الحقوق محفوظة</div>
    </footer>
  );
}
