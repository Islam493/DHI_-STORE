"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, fmt } from "@/components/admin/api";
import StatusPicker from "@/components/admin/StatusPicker";
import { statuses, type Order, type Status } from "@/lib/order-types";

type Row = Order & { image: string | null };

const date = (iso: string) => {
  const d = new Date(iso);
  return { d: d.toLocaleDateString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric" }), t: d.toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" }) };
};

function Orders() {
  const router = useRouter();
  const sp = useSearchParams();
  const status = sp.get("status") || "";
  const [q, setQ] = useState(sp.get("q") || "");
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState<string[]>([]);

  const load = useCallback(async (offset = 0, search = q) => {
    setLoading(true); setErr("");
    try {
      const p = new URLSearchParams({ status, q: search, offset: String(offset) });
      const d = await api<{ orders: Row[]; counts: Record<string, number> }>(`/api/admin/orders?${p}`);
      setRows((prev) => (offset ? [...prev, ...d.orders] : d.orders));
      setCounts(d.counts); setMore(d.orders.length === 50);
      if (!offset) setSel([]);
    } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, [status, q]);

  useEffect(() => { const s = sp.get("q") || ""; setQ(s); load(0, s); }, [status, sp.get("q")]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(ids: string[], s: Status) {
    const prev = rows;
    setRows(rows.map((r) => (ids.includes(r.id) ? { ...r, status: s } : r)));
    try { await api("/api/admin/orders", { method: "PATCH", body: JSON.stringify({ ids, status: s }) }); setSel([]); load(0); }
    catch (e) { setRows(prev); alert((e as Error).message); }
  }

  const tabs = [["", "الكل", "📋"], ...Object.entries(statuses).map(([k, v]) => [k, v.label, v.icon])] as [string, string, string][];
  const allSel = rows.length > 0 && sel.length === rows.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-navy">🛒 الطلبات</h1>
        <form onSubmit={(e) => { e.preventDefault(); router.push(`/admin/orders?${new URLSearchParams({ ...(status && { status }), ...(q && { q }) })}`); }} className="flex w-full gap-2 sm:w-auto">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم، رقم، بلدية، رقم الطلبية..." className="flex-1 rounded-xl border border-line bg-white px-4 py-2 text-sm outline-none focus:border-brand sm:w-72" />
          <button className="rounded-xl bg-navy px-4 text-sm font-bold text-white">بحث</button>
        </form>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {tabs.filter(([k]) => !k || counts[k] || k === status).map(([k, label, icon]) => (
          <button key={k} onClick={() => router.push(k ? `/admin/orders?status=${k}` : "/admin/orders")}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold ring-1 transition ${status === k ? "bg-navy text-white ring-navy" : "bg-white text-muted ring-line hover:ring-brand"}`}>
            {icon} {label} <span className="mr-1 rounded-full bg-black/10 px-1.5">{counts[k || "all"] ?? 0}</span>
          </button>
        ))}
      </div>

      {sel.length > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-3 rounded-2xl bg-navy p-3 text-sm text-white shadow-lg">
          <b>{sel.length} محددة</b>
          <span className="text-white/60">بدّل الحالة:</span>
          <StatusPicker value="" onPick={(s) => setStatus(sel, s)} />
          <button onClick={() => setSel([])} className="mr-auto rounded-lg bg-white/10 px-3 py-1.5 font-bold">إلغاء</button>
        </div>
      )}

      {err && <p className="rounded-2xl bg-sale/10 p-4 font-semibold text-sale">{err}</p>}

      <div className="overflow-visible rounded-2xl bg-white shadow-sm ring-1 ring-line">
        {/* الكمبيوتر: جدول */}
        <table className="hidden w-full text-sm md:table">
          <thead className="border-b border-line text-right text-xs text-muted">
            <tr>
              <th className="w-10 p-3"><input type="checkbox" className="size-4" checked={allSel} onChange={() => setSel(allSel ? [] : rows.map((r) => r.id))} /></th>
              <th className="p-3 font-bold">المنتج</th><th className="p-3 font-bold">العميل</th><th className="p-3 font-bold">رقم الهاتف</th>
              <th className="p-3 font-bold">الولاية</th><th className="p-3 font-bold">تاريخ الطلب</th><th className="p-3 font-bold">الحالة</th>
              <th className="p-3 font-bold">المجموع</th><th className="w-10 p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((o) => { const t = date(o.created_at); return (
              <tr key={o.id} className={`hover:bg-soft/60 ${sel.includes(o.id) ? "bg-brand/5" : ""}`}>
                <td className="p-3"><input type="checkbox" className="size-4" checked={sel.includes(o.id)} onChange={() => setSel(sel.includes(o.id) ? sel.filter((x) => x !== o.id) : [...sel, o.id])} /></td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {o.image ? <img src={o.image} alt="" className="size-11 rounded-lg object-cover" /> : <span className="size-11 rounded-lg bg-soft" />}
                    <span className="line-clamp-2 max-w-40 text-xs">{o.product_name}{o.quantity > 1 && <b> ×{o.quantity}</b>}</span>
                  </div>
                </td>
                <td className="p-3 font-bold text-navy">{o.customer_name}</td>
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

        {/* التيليفون: لستة */}
        <ul className="divide-y divide-line md:hidden">
          {rows.map((o) => (
            <li key={o.id} className="flex gap-3 p-3">
              <Link href={`/admin/orders/${o.id}`} className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {o.image ? <img src={o.image} alt="" className="size-14 rounded-xl object-cover" /> : <span className="block size-14 rounded-xl bg-soft" />}
              </Link>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-2">
                  <span className="truncate font-extrabold text-navy">{o.customer_name}</span>
                  <span className="shrink-0 text-sm font-extrabold text-brand">{fmt(o.total)}</span>
                </Link>
                <p className="truncate text-xs text-muted">{o.wilaya_name} · {date(o.created_at).d} · {o.product_name}</p>
                <div className="flex items-center gap-2">
                  <a href={`tel:${o.phone}`} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white">📞 اتصل</a>
                  <StatusPicker value={o.status} onPick={(s) => setStatus([o.id], s)} />
                </div>
              </div>
            </li>
          ))}
        </ul>

        {!loading && rows.length === 0 && !err && <p className="p-10 text-center text-muted">ما كانش طلبيات هنا</p>}
        {loading && <p className="p-6 text-center text-muted">جاري التحميل...</p>}
      </div>
      {more && !loading && <button onClick={() => load(rows.length)} className="w-full rounded-xl bg-white py-3 font-bold text-brand ring-1 ring-line">عرض المزيد</button>}
    </div>
  );
}

export default function Page() { return <Suspense><Orders /></Suspense>; }
