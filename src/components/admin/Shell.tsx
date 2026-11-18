"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";

const nav = [
  { href: "/admin", label: "الرئيسية", icon: "📊" },
  { href: "/admin/orders", label: "الطلبيات", icon: "🛒" },
  { href: "/admin/products", label: "المنتجات", icon: "📦" },
  { href: "/admin/settings", label: "الإعدادات", icon: "⚙️" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const active = (h: string) => (h === "/admin" ? path === "/admin" : path.startsWith(h));
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }
  return (
    <div className="pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/admin"><Logo /></Link>
          <nav className="hidden gap-1 md:flex">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className={`rounded-xl px-3 py-2 text-sm font-bold ${active(n.href) ? "bg-brand text-white" : "text-muted hover:bg-soft"}`}>{n.icon} {n.label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <a href="/" target="_blank" className="rounded-xl px-3 py-2 font-bold text-brand hover:bg-soft">🏪 المتجر</a>
            <button onClick={logout} className="rounded-xl px-3 py-2 font-bold text-muted hover:bg-soft">خروج</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-white md:hidden">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className={`flex flex-col items-center py-2 text-xs font-bold ${active(n.href) ? "text-brand" : "text-muted"}`}>
            <span className="text-xl">{n.icon}</span>{n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
