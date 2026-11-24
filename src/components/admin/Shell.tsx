"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConfirmHost, MeProvider, Toaster, useMe } from "./ui";
import { roleLabel, type Perm } from "@/lib/perms";

type Item = { href: string; label: string; icon: string; perm?: Perm; soon?: boolean };
const nav: Item[] = [
  { href: "/admin", label: "الرئيسية", icon: "📊", perm: "orders.view" },
  { href: "/admin/orders", label: "الطلبات", icon: "🛒", perm: "orders.view" },
  { href: "/admin/abandoned", label: "الطلبات المتروكة", icon: "🛍️", perm: "orders.view" },
  { href: "/admin/customers", label: "الزبائن", icon: "👥", perm: "customers.view" },
  { href: "/admin/products", label: "المنتجات وصفحات الهبوط", icon: "📦", perm: "products.view" },
  { href: "/admin/inventory", label: "المخزون", icon: "🏬", perm: "products.view" },
  { href: "/admin/reviews", label: "آراء الزبائن", icon: "⭐", perm: "reviews.edit" },
  { href: "/admin/delivery", label: "التوصيل", icon: "🚚", perm: "orders.ship" },
  { href: "/admin/automation", label: "الأتمتة (واتساب)", icon: "🤖", perm: "settings.edit" },
  { href: "/admin/analytics", label: "الإحصائيات", icon: "📈", perm: "stats.view" },
  { href: "/admin/profit", label: "الأرباح", icon: "💹", perm: "stats.view" },
  { href: "/admin/users", label: "الفريق", icon: "🧑‍💼", perm: "users.manage" },
  { href: "/admin/activity", label: "سجل النشاط", icon: "🕓", perm: "audit.view" },
  { href: "/admin/settings", label: "الإعدادات", icon: "⚙️", perm: "settings.edit" },
];

type Notif = { newOrders: number; abandoned?: number; lowStock: { id: string; name: string; stock: number }[] };

function Bell() {
  const [n, setN] = useState<Notif | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    const load = () => { if (document.visibilityState === "visible") fetch("/api/admin/notify").then((r) => r.ok && r.json()).then((d) => alive && d && setN(d)).catch(() => {}); };
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const count = (n?.newOrders || 0) + (n?.abandoned || 0) + (n?.lowStock.length || 0);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-label="التنبيهات" className="relative grid size-10 place-items-center rounded-xl bg-soft text-lg">
        🔔{count > 0 && <span className="absolute -left-1 -top-1 grid min-w-5 place-items-center rounded-full bg-sale px-1 text-[10px] font-extrabold text-white">{count > 99 ? "99+" : count}</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-50 w-72 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-line">
          <p className="border-b border-line px-4 py-3 font-extrabold text-navy">🔔 التنبيهات</p>
          {!count && <p className="p-5 text-center text-sm text-muted">ما كانش تنبيهات 👌</p>}
          {!!n?.newOrders && <Link href="/admin/orders?status=new" onClick={() => setOpen(false)} className="block border-b border-line px-4 py-3 text-sm hover:bg-soft">🆕 <b>{n.newOrders}</b> طلبية جديدة تستنى التأكيد</Link>}
          {!!n?.abandoned && <Link href="/admin/abandoned" onClick={() => setOpen(false)} className="block border-b border-line px-4 py-3 text-sm hover:bg-soft">🛍️ <b>{n.abandoned}</b> طلبية متروكة — اتصل بيهم</Link>}
          {n?.lowStock.map((p) => (
            <Link key={p.id} href="/admin/inventory" onClick={() => setOpen(false)} className="block border-b border-line px-4 py-3 text-sm last:border-0 hover:bg-soft">
              {p.stock === 0 ? "⛔ نفذ" : "⚠️ قليل"}: {p.name} <b className="text-sale">({p.stock})</b>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => setOpen(false), [path]);
  const active = (h: string) => (h === "/admin" ? path === "/admin" : path.startsWith(h));
  const items = nav.filter((n) => n.soon || !n.perm || me?.perms.includes(n.perm));

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  const side = (
    <aside className="flex h-full w-64 flex-col bg-gradient-to-b from-navy to-navy-2 text-white">
      <div className="flex flex-col items-center gap-2 border-b border-white/10 p-5">
        <Image src="/logo.png" alt="DHI Electronics" width={64} height={64} className="rounded-full bg-white shadow-lg" />
        <p className="font-extrabold">DHI Electronics</p>
        <a href="/" target="_blank" rel="noopener" className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold hover:bg-white/20">🏪 زيارة المتجر ↗</a>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {!me && Array.from({ length: 8 }, (_, i) => <div key={i} className="mb-1 h-10 animate-pulse rounded-xl bg-white/5" />)}
        {me && items.map((n) => n.soon ? (
          <span key={n.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/35">
            <span className="text-lg">{n.icon}</span>{n.label}<span className="mr-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px]">قريبا</span>
          </span>
        ) : (
          <Link key={n.href} href={n.href} prefetch
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${active(n.href) ? "bg-brand text-white shadow-lg shadow-brand/30" : "text-white/80 hover:bg-white/10"}`}>
            <span className="text-lg">{n.icon}</span>{n.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        {me && <p className="px-3 pb-2 text-xs text-white/60">👤 {me.name} · {roleLabel[me.role]}</p>}
        <button onClick={logout} className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-right text-sm font-bold text-white/70 hover:bg-white/10">🚪 تسجيل الخروج</button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-dvh bg-soft">
      <div className="fixed inset-y-0 right-0 z-40 hidden lg:block print:hidden">{side}</div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="سكّر" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0">{side}</div>
        </div>
      )}
      <div className="lg:mr-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-white/95 px-3 backdrop-blur md:px-4 print:hidden">
          <button onClick={() => setOpen(true)} aria-label="القائمة" className="grid size-10 shrink-0 place-items-center rounded-xl bg-soft text-xl lg:hidden">☰</button>
          <form onSubmit={(e) => { e.preventDefault(); router.push(`/admin/orders?q=${encodeURIComponent(q)}`); }} className="flex min-w-0 max-w-md flex-1">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 طلبية: اسم، هاتف، رقم..." className="w-full min-w-0 rounded-r-xl border border-l-0 border-line bg-soft px-3 py-2 text-sm outline-none focus:border-brand" />
            <button className="rounded-l-xl bg-brand px-3 text-sm font-bold text-white">بحث</button>
          </form>
          <div className="mr-auto flex items-center gap-2">
            <Bell />
            {me && <span className="hidden items-center gap-2 rounded-xl bg-soft px-3 py-2 text-sm font-bold text-navy sm:flex">👤 {me.name}<span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] text-brand">{roleLabel[me.role]}</span></span>}
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-3 md:p-6">{children}</main>
      </div>
      <Toaster />
      <ConfirmHost />
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  return <MeProvider><Frame>{children}</Frame></MeProvider>;
}
