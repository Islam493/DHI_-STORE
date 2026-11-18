"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, fmt } from "@/components/admin/api";
import StatusPicker from "@/components/admin/StatusPicker";
import { Empty, Skeleton, confirmAction, toast, useCan } from "@/components/admin/ui";
import { groups, statuses, type Order, type Status } from "@/lib/order-types";
import { defaultWilayas } from "@/lib/wilayas";

type Row = Order & { image: string | null };
type Res = { orders: Row[]; total: number; page: number; per: number; counts: Record<string, number>; products: { id: string; name: string }[] };

const dzToday = () => new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() + 3600_000 - n * 86400_000).toISOString().slice(0, 10);
const when = (iso: string) => {
  const d = new Date(iso);
  return { d: d.toLocaleDateString("fr-DZ", { timeZone: "Africa/Algiers", day: "2-digit", month: "2-digit", year: "numeric" }), t: d.toLocaleTimeString("fr-DZ", { timeZone: "Africa/Algiers", hour: "2-digit", minute: "2-digit" }) };
};

function Orders() {
  const router = useRouter();
  const sp = useSearchParams();
  const can = useCan();
  const get = (k: string) => sp.get(k) || "";
  const [q, setQ] = useState(get("q"));
  const [d, setD] = useState<Res | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const key = sp.toString();

  const setParams = useCallback((patch: Record<string, string>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k); }
    if (!("page" in patch)) n.delete("page");
    router.push(`/admin/orders${n.toString() ? `?${n}` : ""}`);
  }, [router, sp]);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { setD(await api<Res>(`/api/admin/orders?${key}`)); setSel([]); }
    catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, [key]);
  useEffect(() => { setQ(get("q")); load(); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(ids: string[], s: Status) {
    if (!d) return;
    const prev = d.orders;
    setD({ ...d, orders: d.orders.map((r) => (ids.includes(r.id) ? { ...r, status: s } : r)) });
    try {
      const r = await api<{ errors?: string[] }>("/api/admin/orders", { method: "PATCH", body: JSON.stringify({ ids, status: s }) });
      if (r.errors?.length) toast(r.errors.join(" — "), false); else toast(ids.length > 1 ? `تبدلت ${ids.length} طلبيات لـ «${statuses[s].label}»` : `«${statuses[s].label}»`);
      load();
    } catch (e) { setD({ ...d, orders: prev }); toast((e as Error).message, false); }
  }

  async function removeSel() {
    if (!(await confirmAction(`تحذف ${sel.length} طلبيات نهائياً؟ ما تقدرش ترجعهم. (المخزون يرجع وحدو)`))) return;
    try {
      const r = await api<{ deleted: number }>("/api/admin/orders", { method: "DELETE", body: JSON.stringify({ ids: sel }) });
      toast(`تحذفو ${r.deleted} طلبيات`); load();
    } catch (e) { toast((e as Error).message, false); }
  }

  const status = get("status");
  const counts = d?.counts || {};
  const sumOf = (list: Status[]) => list.reduce((a, s) => a + (counts[s] || 0), 0);
  const tabs = useMemo(() => [
    ["", "الكل", "📋", counts.all || 0],
    ["pending", "تستنى التأكيد", "⏳", sumOf(groups.pending)],
    ...(Object.keys(statuses) as Status[]).map((k) => [k, statuses[k].label, statuses[k].icon, counts[k] || 0]),
  ] as [string, string, string, number][], [counts]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = d ? Math.max(1, Math.ceil(d.total / d.per)) : 1;
  const page = d?.page || 1;
  const allSel = !!d?.orders.length && sel.length === d.orders.length;
  const exportUrl = (extra: Record<string, string> = {}) => `/api/admin/orders/export?${new URLSearchParams({ ...Object.fromEntries(sp.entries()), ...extra })}`;
  const activeFilters = ["from", "to", "wilaya", "product"].filter((k) => get(k)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-navy">🛒 الطلبات <span className="text-base font-bold text-muted">({(d?.total ?? 0).toLocaleString("en-US")})</span></h1>
        <div className="flex gap-2">
          {can("orders.export") && <a href={exportUrl()} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-navy ring-1 ring-line hover:ring-brand">⬇️ تصدير Excel</a>}
        </div>
      </div>

      {/* الحالات */}
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {tabs.filter(([k, , , n]) => !k || k === "pending" || n || k === status).map(([k, label, icon, n]) => (
          <button key={k} onClick={() => setParams({ status: k })}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold ring-1 transition ${status === k ? "bg-navy text-white ring-navy" : "bg-white text-muted ring-line hover:ring-brand"}`}>
            {icon} {label} <span className="mr-1 rounded-full bg-black/10 px-1.5">{n.toLocaleString("en-US")}</span>
          </button>
        ))}
      </div>

      {/* البحث والفلاتر */}
      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-line">
        <form onSubmit={(e) => { e.preventDefault(); setParams({ q }); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 اسم، هاتف، رقم الطلبية، بلدية، رقم التتبع..." className="min-w-0 flex-1 rounded-xl border border-line bg-soft px-4 py-2.5 text-sm outline-none focus:border-brand" />
          <button className="rounded-xl bg-navy px-4 text-sm font-bold text-white">بحث</button>
          <button type="button" onClick={() => setShowFilters(!showFilters)} className={`rounded-xl px-3 text-sm font-bold ring-1 ${activeFilters ? "bg-brand/10 text-brand ring-brand" : "ring-line"}`}>⚙️ فلاتر{activeFilters ? ` (${activeFilters})` : ""}</button>
        </form>
        {(showFilters || activeFilters > 0) && (
          <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="flex flex-wrap gap-1.5 lg:col-span-6">
              {[["اليوم", dzToday(), dzToday()], ["أمس", daysAgo(1), daysAgo(1)], ["7 أيام", daysAgo(6), dzToday()], ["30 يوم", daysAgo(29), dzToday()]].map(([l, f, t]) => (
                <button key={l} onClick={() => setParams({ from: f, to: t })} className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${get("from") === f && get("to") === t ? "bg-brand text-white ring-brand" : "ring-line"}`}>{l}</button>
              ))}
              {activeFilters > 0 && <button onClick={() => setParams({ from: "", to: "", wilaya: "", product: "" })} className="rounded-full px-3 py-1.5 text-xs font-bold text-sale ring-1 ring-sale/30">✕ مسح الفلاتر</button>}
            </div>
            <label className="text-xs font-bold text-muted">من<input type="date" value={get("from")} onChange={(e) => setParams({ from: e.target.value })} className="mt-1 w-full rounded-lg border border-line px-2 py-2 text-sm" /></label>
            <label className="text-xs font-bold text-muted">حتى<input type="date" value={get("to")} onChange={(e) => setParams({ to: e.target.value })} className="mt-1 w-full rounded-lg border border-line px-2 py-2 text-sm" /></label>
            <label className="text-xs font-bold text-muted">الولاية
              <select value={get("wilaya")} onChange={(e) => setParams({ wilaya: e.target.value })} className="mt-1 w-full rounded-lg border border-line px-2 py-2 text-sm">
                <option value="">كل الولايات</option>{defaultWilayas.map((w) => <option key={w.code} value={w.code}>{String(w.code).padStart(2, "0")} {w.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-muted lg:col-span-2">المنتج
              <select value={get("product")} onChange={(e) => setParams({ product: e.target.value })} className="mt-1 w-full rounded-lg border border-line px-2 py-2 text-sm">
                <option value="">كل المنتجات</option>{d?.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-muted">الترتيب
              <select value={get("sort") || "new"} onChange={(e) => setParams({ sort: e.target.value === "new" ? "" : e.target.value })} className="mt-1 w-full rounded-lg border border-line px-2 py-2 text-sm">
                <option value="new">الأحدث</option><option value="old">الأقدم</option><option value="total_desc">المبلغ: الأكبر</option><option value="total_asc">المبلغ: الأصغر</option>
              </select>
            </label>
          </div>
        )}
      </div>

      {sel.length > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-2xl bg-navy p-3 text-sm text-white shadow-lg">
          <b>{sel.length} محددة</b>
          <span className="text-white/60">بدّل الحالة:</span>
          <StatusPicker value="" onPick={async (s) => { if (await confirmAction(`تبدّل ${sel.length} طلبيات لـ «${statuses[s].label}»؟`, false)) setStatus(sel, s); }} />
          <a href={`/admin/print?ids=${sel.join(",")}`} target="_blank" className="rounded-lg bg-white/10 px-3 py-1.5 font-bold">🖨️ طباعة</a>
          {can("orders.export") && <a href={exportUrl({ ids: sel.join(",") })} className="rounded-lg bg-white/10 px-3 py-1.5 font-bold">⬇️ تصدير</a>}
          {can("orders.delete") && <button onClick={removeSel} className="rounded-lg bg-sale px-3 py-1.5 font-bold">🗑️ حذف نهائي</button>}
          <button onClick={() => setSel([])} className="mr-auto rounded-lg bg-white/10 px-3 py-1.5 font-bold">إلغاء</button>
        </div>
      )}

      {err && <p className="rounded-2xl bg-sale/10 p-4 font-semibold text-sale">{err}</p>}
      {loading && !d ? <Skeleton rows={8} /> : d && d.orders.length === 0 ? (
        <Empty icon="📭" text="ما كانش طلبيات بهاد الفلاتر" />
      ) : d && (
        <div className={`overflow-visible rounded-2xl bg-white shadow-sm ring-1 ring-line ${loading ? "opacity-60" : ""}`}>
          <table className="hidden w-full text-sm lg:table">
            <thead className="border-b border-line text-right text-xs text-muted">
              <tr>
                <th className="w-10 p-3"><input type="checkbox" aria-label="تحديد الكل" className="size-4" checked={allSel} onChange={() => setSel(allSel ? [] : d.orders.map((r) => r.id))} /></th>
                <th className="p-3 font-bold">الطلبية</th><th className="p-3 font-bold">العميل</th><th className="p-3 font-bold">الهاتف</th>
                <th className="p-3 font-bold">الولاية</th><th className="p-3 font-bold">التاريخ</th><th className="p-3 font-bold">الحالة</th>
                <th className="p-3 font-bold">المجموع</th><th className="w-10 p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.orders.map((o) => { const t = when(o.created_at); return (
                <tr key={o.id} className={`hover:bg-soft/60 ${sel.includes(o.id) ? "bg-brand/5" : ""}`}>
                  <td className="p-3"><input type="checkbox" aria-label="تحديد" className="size-4" checked={sel.includes(o.id)} onChange={() => setSel(sel.includes(o.id) ? sel.filter((x) => x !== o.id) : [...sel, o.id])} /></td>
                  <td className="p-3">
                    <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {o.image ? <img src={o.image} alt="" loading="lazy" className="size-11 rounded-lg object-cover" /> : <span className="size-11 rounded-lg bg-soft" />}
                      <span className="min-w-0"><span className="line-clamp-1 max-w-44 text-xs font-bold">{o.product_name}{o.quantity > 1 && <b> ×{o.quantity}</b>}</span><span className="text-[11px] text-muted" dir="ltr">#{o.id}</span></span>
                    </Link>
                  </td>
                  <td className="p-3 font-bold text-navy">{o.customer_name}{o.internal_note && <span title={o.internal_note}> 📝</span>}</td>
                  <td className="p-3"><a href={`tel:${o.phone}`} className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1.5 font-bold text-brand hover:bg-brand hover:text-white" dir="ltr">📞 {o.phone}</a></td>
                  <td className="p-3 text-xs">{o.wilaya_code} - {o.wilaya_name}<br /><span className="text-muted">{o.delivery_method === "desk" ? "🏢 مكتب" : "🏠 دار"}</span></td>
                  <td className="p-3 text-xs text-muted" dir="ltr">{t.d}<br />{t.t}</td>
                  <td className="p-3"><StatusPicker value={o.status} onPick={(s) => setStatus([o.id], s)} />{o.tracking && <p className="mt-1 text-[10px] text-violet-700" dir="ltr">🚚 {o.tracking}</p>}</td>
                  <td className="p-3 font-extrabold text-navy">{fmt(o.total)}</td>
                  <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="grid size-9 place-items-center rounded-lg bg-soft hover:bg-brand hover:text-white" title="فتح">✏️</Link></td>
                </tr>
              ); })}
            </tbody>
          </table>
          <ul className="divide-y divide-line lg:hidden">
            {d.orders.map((o) => (
              <li key={o.id} className={`flex gap-3 p-3 ${sel.includes(o.id) ? "bg-brand/5" : ""}`}>
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <input type="checkbox" aria-label="تحديد" className="size-4" checked={sel.includes(o.id)} onChange={() => setSel(sel.includes(o.id) ? sel.filter((x) => x !== o.id) : [...sel, o.id])} />
                  <Link href={`/admin/orders/${o.id}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {o.image ? <img src={o.image} alt="" loading="lazy" className="size-14 rounded-xl object-cover" /> : <span className="block size-14 rounded-xl bg-soft" />}
                  </Link>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-2">
                    <span className="truncate font-extrabold text-navy">{o.customer_name}</span>
                    <span className="shrink-0 text-sm font-extrabold text-brand">{fmt(o.total)}</span>
                  </Link>
                  <p className="truncate text-xs text-muted">{o.wilaya_name} · {when(o.created_at).d} · {o.product_name}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`tel:${o.phone}`} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white">📞 اتصل</a>
                    <StatusPicker value={o.status} onPick={(s) => setStatus([o.id], s)} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* الصفحات */}
      {d && pages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <button disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })} className="rounded-lg bg-white px-3 py-2 text-sm font-bold ring-1 ring-line disabled:opacity-40">→</button>
          {Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2).map((n, i, arr) => (
            <span key={n} className="flex items-center gap-1.5">
              {i > 0 && n - arr[i - 1] > 1 && <span className="text-muted">…</span>}
              <button onClick={() => setParams({ page: String(n) })} className={`min-w-9 rounded-lg px-3 py-2 text-sm font-bold ring-1 ${n === page ? "bg-navy text-white ring-navy" : "bg-white ring-line"}`}>{n}</button>
            </span>
          ))}
          <button disabled={page >= pages} onClick={() => setParams({ page: String(page + 1) })} className="rounded-lg bg-white px-3 py-2 text-sm font-bold ring-1 ring-line disabled:opacity-40">←</button>
          <select value={String(d.per)} onChange={(e) => setParams({ per: e.target.value })} className="mr-2 rounded-lg border border-line bg-white px-2 py-2 text-xs font-bold">
            {[25, 50, 100].map((n) => <option key={n} value={n}>{n} فالصفحة</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

export default function Page() { return <Suspense><Orders /></Suspense>; }
