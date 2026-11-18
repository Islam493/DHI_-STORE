"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, fmt, timeAgo } from "@/components/admin/api";
import { Empty, Skeleton, toast } from "@/components/admin/ui";
import type { Customer } from "@/lib/customers";

type Res = { rows: Customer[]; total: number; page: number; per: number };

function Customers() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") || "");
  const [d, setD] = useState<Res | null>(null);
  const key = sp.toString();
  const set = (patch: Record<string, string>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k); }
    if (!("page" in patch)) n.delete("page");
    router.push(`/admin/customers?${n}`);
  };
  useEffect(() => { api<Res>(`/api/admin/customers?${key}`).then(setD).catch((e) => toast(e.message, false)); }, [key]);

  const sort = sp.get("sort") || "recent";
  const pages = d ? Math.max(1, Math.ceil(d.total / d.per)) : 1;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-navy">👥 الزبائن <span className="text-base font-bold text-muted">({d?.total.toLocaleString("en-US") ?? "…"})</span></h1>
      <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-3 ring-1 ring-line">
        <form onSubmit={(e) => { e.preventDefault(); set({ q }); }} className="flex min-w-0 flex-1 gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 اسم، هاتف، ولاية..." className="min-w-0 flex-1 rounded-xl border border-line bg-soft px-4 py-2.5 text-sm outline-none focus:border-brand" />
          <button className="rounded-xl bg-navy px-4 text-sm font-bold text-white">بحث</button>
        </form>
        <select value={sort} onChange={(e) => set({ sort: e.target.value })} className="rounded-xl border border-line bg-white px-3 text-sm font-bold">
          <option value="recent">آخر طلبية</option><option value="orders">أكثر طلبيات</option><option value="spent">أكثر صرف</option><option value="returned">أكثر مرجوع</option>
        </select>
        <button onClick={() => set({ returning: sp.get("returning") ? "" : "1" })} className={`rounded-xl px-3 text-sm font-bold ring-1 ${sp.get("returning") ? "bg-brand text-white ring-brand" : "ring-line"}`}>🔁 الزبائن اللي رجعو</button>
      </div>

      {!d ? <Skeleton rows={8} /> : d.rows.length === 0 ? <Empty icon="👥" text="ما كانش زبائن هنا" /> : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line">
          <table className="hidden w-full text-sm md:table">
            <thead className="border-b border-line text-right text-xs text-muted">
              <tr><th className="p-3">الزبون</th><th className="p-3">الهاتف</th><th className="p-3">الولاية</th><th className="p-3 text-center">الطلبيات</th><th className="p-3 text-center">✅ / ❌ / ↩️</th><th className="p-3">الصرف</th><th className="p-3">آخر طلبية</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.rows.map((c) => (
                <tr key={c.phone} className="cursor-pointer hover:bg-soft/60" onClick={() => router.push(`/admin/customers/${c.phone}`)}>
                  <td className="p-3 font-bold text-navy">{c.name} {c.orders >= 2 && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] text-brand">🔁 يرجع</span>}</td>
                  <td className="p-3" dir="ltr"><a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="font-bold text-brand">{c.phone}</a></td>
                  <td className="p-3 text-xs">{c.wilaya_name}</td>
                  <td className="p-3 text-center font-extrabold">{c.orders}</td>
                  <td className="p-3 text-center text-xs"><b className="text-ok">{c.delivered}</b> / <b className="text-muted">{c.cancelled}</b> / <b className="text-sale">{c.returned}</b></td>
                  <td className="p-3 font-extrabold text-navy">{fmt(Number(c.spent))}</td>
                  <td className="p-3 text-xs text-muted">{timeAgo(c.last_order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-line md:hidden">
            {d.rows.map((c) => (
              <li key={c.phone}>
                <Link href={`/admin/customers/${c.phone}`} className="flex items-center gap-3 p-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/10 font-extrabold text-brand">{c.name.slice(0, 1)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-navy">{c.name} {c.orders >= 2 && "🔁"}</span>
                    <span className="text-xs text-muted" dir="ltr">{c.phone}</span> <span className="text-xs text-muted">· {c.wilaya_name}</span>
                  </span>
                  <span className="text-left text-xs"><b className="block text-sm text-navy">{c.orders} طلبية</b>✅{c.delivered} ↩️{c.returned}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {d && pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={d.page <= 1} onClick={() => set({ page: String(d.page - 1) })} className="rounded-lg bg-white px-3 py-2 text-sm font-bold ring-1 ring-line disabled:opacity-40">→</button>
          <span className="text-sm text-muted">{d.page} / {pages}</span>
          <button disabled={d.page >= pages} onClick={() => set({ page: String(d.page + 1) })} className="rounded-lg bg-white px-3 py-2 text-sm font-bold ring-1 ring-line disabled:opacity-40">←</button>
        </div>
      )}
    </div>
  );
}

export default function Page() { return <Suspense><Customers /></Suspense>; }
