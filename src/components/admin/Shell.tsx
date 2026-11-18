"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Item = { href: string; label: string; icon: string; soon?: boolean };
const nav: Item[] = [
  { href: "/admin", label: "الرئيسية", icon: "📊" },
  { href: "/admin/orders", label: "الطلبات", icon: "🛒" },
  { href: "/admin/abandoned", label: "الطلبات المتروكة", icon: "🛍️", soon: true },
  { href: "/admin/products", label: "المنتجات", icon: "📦" },
  { href: "/admin/reviews", label: "آراء الزبائن", icon: "⭐", soon: true },
  { href: "/admin/landing", label: "صفحات الهبوط", icon: "🚀", soon: true },
  { href: "/admin/design", label: "تصميم المتجر", icon: "🎨", soon: true },
  { href: "/admin/delivery", label: "التوصيل", icon: "🚚" },
  { href: "/admin/stats", label: "الإحصائيات", icon: "📈", soon: true },
  { href: "/admin/settings", label: "الإعدادات", icon: "⚙️" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => setOpen(false), [path]);
  const active = (h: string) => (h === "/admin" ? path === "/admin" : path.startsWith(h));

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  const side = (
    <aside className="flex h-full w-64 flex-col bg-gradient-to-b from-navy to-navy-2 text-white">
      <div className="flex flex-col items-center gap-2 border-b border-white/10 p-5">
        <Image src="/logo.png" alt="DHI Electronics" width={72} height={72} className="rounded-full bg-white shadow-lg" />
        <p className="font-extrabold">DHI Electronics</p>
        <a href="/" target="_blank" className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold hover:bg-white/20">🏪 زيارة المتجر ↗</a>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.map((n) => n.soon ? (
          <span key={n.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/40">
            <span className="text-lg">{n.icon}</span>{n.label}
            <span className="mr-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px]">قريبا</span>
          </span>
        ) : (
          <Link key={n.href} href={n.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${active(n.href) ? "bg-brand text-white shadow-lg shadow-brand/30" : "text-white/80 hover:bg-white/10"}`}>
            <span className="text-lg">{n.icon}</span>{n.label}
          </Link>
        ))}
      </nav>
      <button onClick={logout} className="m-3 rounded-xl bg-white/5 px-3 py-2.5 text-right text-sm font-bold text-white/70 hover:bg-white/10">🚪 تسجيل الخروج</button>
    </aside>
  );

  return (
    <div className="min-h-dvh bg-soft">
      <div className="fixed inset-y-0 right-0 z-40 hidden lg:block">{side}</div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="سكّر" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0">{side}</div>
        </div>
      )}
      <div className="lg:mr-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur">
          <button onClick={() => setOpen(true)} aria-label="القائمة" className="grid size-10 place-items-center rounded-xl bg-soft text-xl lg:hidden">☰</button>
          <form onSubmit={(e) => { e.preventDefault(); router.push(`/admin/orders?q=${encodeURIComponent(q)}`); }} className="flex max-w-md flex-1">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 البحث عن طلبية (اسم، رقم...)" className="w-full rounded-r-xl border border-l-0 border-line bg-soft px-4 py-2 text-sm outline-none focus:border-brand" />
            <button className="rounded-l-xl bg-brand px-4 text-sm font-bold text-white">بحث</button>
          </form>
          <Image src="/logo.png" alt="" width={36} height={36} className="mr-auto rounded-full lg:hidden" />
        </header>
        <main className="mx-auto max-w-6xl p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
