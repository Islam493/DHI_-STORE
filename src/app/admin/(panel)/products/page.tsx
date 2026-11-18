"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmt } from "@/components/admin/api";
import { categories } from "@/lib/categories";
import type { Product } from "@/lib/catalog";

export default function Products() {
  const [list, setList] = useState<Product[] | null>(null);
  const [storage, setStorage] = useState("");
  const [err, setErr] = useState("");
  const load = () => api<{ products: Product[]; storage: string }>("/api/admin/products").then((d) => { setList(d.products); setStorage(d.storage); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  async function toggle(p: Product) {
    setList((l) => l!.map((x) => (x.id === p.id ? { ...x, active: !p.active } : x)));
    try { await api(`/api/admin/products/${p.id}`, { method: "PUT", body: JSON.stringify({ active: !p.active }) }); }
    catch (e) { alert((e as Error).message); load(); }
  }

  if (err) return <p className="rounded-2xl bg-sale/10 p-4 font-semibold text-sale">{err}</p>;
  if (!list) return <p className="p-8 text-center text-muted">جاري التحميل...</p>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-navy">📦 المنتجات <span className="text-sm text-muted">({list.length})</span></h1>
        <Link href="/admin/products/new" className="rounded-xl bg-brand px-4 py-2.5 font-bold text-white">➕ منتج جديد</Link>
      </div>
      {storage === "local" && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">وضع التجربة: البيانات محفوظة محلياً.</p>}
      <div className="space-y-2">
        {list.map((p) => {
          const warn = p.price <= 0 ? "بلا سعر" : p.images.length === 0 ? "بلا صورة" : "";
          return (
            <div key={p.id} className={`flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-line ${p.active ? "" : "opacity-60"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.images[0] || "data:image/gif;base64,R0lGODlhAQABAAAAACw="} alt="" className="size-16 shrink-0 rounded-xl bg-soft object-cover" />
              <Link href={`/admin/products/${p.id}`} className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-bold text-navy">{p.name}</p>
                <p className="text-sm font-extrabold text-brand">{fmt(p.price)}</p>
                <p className="text-xs text-muted">{categories.find((c) => c.slug === p.category)?.name}{warn && <span className="mr-2 font-bold text-sale">⚠️ {warn}</span>}</p>
              </Link>
              <button onClick={() => toggle(p)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${p.active ? "bg-ok/10 text-ok" : "bg-gray-200 text-gray-600"}`}>
                {p.active ? "👁️ ظاهر" : "🚫 مخبي"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
