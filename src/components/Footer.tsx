import Link from "next/link";
import Logo from "./Logo";
import { categories } from "@/lib/catalog";
import { store } from "@/lib/config";
import { getSettings, waLink } from "@/lib/settings";

export default async function Footer() {
  const s = await getSettings();
  const wa = waLink(s.whatsapp);
  return (
    <footer className="mt-16 bg-navy text-white/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-7">{store.tagline}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {wa && <a href={wa} className="rounded-full bg-wa px-4 py-2 font-bold text-white">واتساب</a>}
            {s.phone && <a href={`tel:${s.phone.replace(/\s/g, "")}`} className="rounded-full bg-white/10 px-4 py-2 font-bold text-white" dir="ltr">{s.phone}</a>}
          </div>
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
