"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, fmt } from "@/components/admin/api";
import { Bars, Meter } from "@/components/admin/charts";
import { NoAccess, Skeleton, toast, useCan, useMe } from "@/components/admin/ui";

type Day = { day: string; orders: number; confirmed: number; delivered: number; returned: number; cancelled: number; gross: number; delivered_revenue: number };
type P = { product_id: string; product_name: string; image: string | null; orders: number; units: number; confirmed: number; delivered: number; returned: number; cancelled: number; delivered_revenue: number };
type W = { wilaya_code: number; wilaya_name: string; orders: number; shipped: number; delivered: number; returned: number; cancelled: number };
type Res = {
  range: { from: string; to: string }; product: string | null; days: Day[];
  totals: { orders: number; confirmed: number; delivered: number; returned: number; cancelled: number; gross: number; delivered_revenue: number; delivered_product_revenue: number; delivered_cost: number };
  kpi: { aov: number; confirmRate: number | null; cancelRate: number | null; deliveryRate: number | null; returnRate: number | null; profit: number | null; profitPartial: boolean };
  products: P[]; wilayas: W[]; productList: { id: string; name: string }[];
};

const iso = (d: Date) => new Date(d.getTime() + 3600_000).toISOString().slice(0, 10);
const ago = (n: number) => iso(new Date(Date.now() - n * 86400_000));

// نكمّلو الأيام الفارغة باش الرسم يكون صحيح
function fill(days: Day[], from: string, to: string) {
  const map = new Map(days.map((d) => [d.day, d]));
  const out: Day[] = [];
  for (let t = new Date(`${from}T12:00:00Z`).getTime(); t <= new Date(`${to}T12:00:00Z`).getTime(); t += 86400_000) {
    const k = new Date(t).toISOString().slice(0, 10);
    out.push(map.get(k) || { day: k, orders: 0, confirmed: 0, delivered: 0, returned: 0, cancelled: 0, gross: 0, delivered_revenue: 0 });
  }
  return out;
}

function Analytics() {
  const can = useCan();
  const me = useMe();
  const router = useRouter();
  const sp = useSearchParams();
  const [d, setD] = useState<Res | null>(null);
  const [loading, setLoading] = useState(true);
  const key = sp.toString();
  const set = (patch: Record<string, string>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k); }
    router.push(`/admin/analytics?${n}`);
  };
  useEffect(() => {
    if (me && !can("stats.view")) return;
    setLoading(true);
    api<Res>(`/api/admin/analytics?${key}`).then(setD).catch((e) => toast(e.message, false)).finally(() => setLoading(false));
  }, [key, me]); // eslint-disable-line react-hooks/exhaustive-deps

  if (me && !can("stats.view")) return <NoAccess />;
  if (!d) return <div className="space-y-4"><Skeleton rows={1} className="h-16" /><Skeleton rows={2} className="h-48" /></div>;
  const days = fill(d.days, d.range.from, d.range.to);
  const t = d.totals;
  const presets: [string, string, string][] = [["7 أيام", ago(6), ago(0)], ["30 يوم", ago(29), ago(0)], ["90 يوم", ago(89), ago(0)], ["هاد العام", `${ago(0).slice(0, 4)}-01-01`, ago(0)]];

  return (
    <div className={`space-y-5 ${loading ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-navy">📈 الإحصائيات</h1>
      </div>
      <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-white p-3 ring-1 ring-line">
        {presets.map(([l, f, to]) => (
          <button key={l} onClick={() => set({ from: f, to })} className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${d.range.from === f && d.range.to === to ? "bg-brand text-white ring-brand" : "ring-line"}`}>{l}</button>
        ))}
        <label className="text-xs font-bold text-muted">من<input type="date" value={d.range.from} onChange={(e) => set({ from: e.target.value })} className="mr-1 rounded-lg border border-line px-2 py-1.5 text-sm" /></label>
        <label className="text-xs font-bold text-muted">حتى<input type="date" value={d.range.to} onChange={(e) => set({ to: e.target.value })} className="mr-1 rounded-lg border border-line px-2 py-1.5 text-sm" /></label>
        <select value={d.product || ""} onChange={(e) => set({ product: e.target.value })} className="min-w-0 max-w-full rounded-lg border border-line px-2 py-1.5 text-sm">
          <option value="">كل المنتجات</option>{d.productList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* المداخيل */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["💵 المبيعات الإجمالية", fmt(t.gross), "كل الطلبيات ماعدا الملغاة"],
          ["✅ مداخيل مستلمة", fmt(t.delivered_revenue), "الطلبيات المكتملة (مع التوصيل)"],
          ["🧮 متوسط الطلبية", fmt(d.kpi.aov), `${t.orders.toLocaleString("en-US")} طلبية`],
          ["📊 الربح", d.kpi.profit === null ? "—" : fmt(d.kpi.profit), d.kpi.profitPartial ? "⚠️ زيد سعر الشراء للمنتجات" : "المستلمة − سعر الشراء"],
        ].map(([l, v, s]) => (
          <div key={l} className="rounded-2xl bg-white p-4 ring-1 ring-line"><p className="text-xs font-bold text-muted">{l}</p><p className="mt-1 text-xl font-extrabold text-navy md:text-2xl">{v}</p><p className="text-[11px] text-muted">{s}</p></div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Meter label="نسبة التأكيد" value={d.kpi.confirmRate} />
        <Meter label="نسبة الاستلام" value={d.kpi.deliveryRate} />
        <Meter label="نسبة الإلغاء" value={d.kpi.cancelRate} good={false} />
        <Meter label="نسبة الإرجاع" value={d.kpi.returnRate} good={false} />
      </div>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="mb-4 font-extrabold text-navy">💰 المبيعات اليومية</h2>
        <Bars data={days} series={[{ key: "gross", label: "المبيعات", color: "#bcd5fa" }, { key: "delivered_revenue", label: "المستلمة", color: "#12a150" }]} fmt={fmt} />
      </section>
      <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="mb-4 font-extrabold text-navy">🛒 عدد الطلبيات</h2>
        <Bars data={days} series={[{ key: "orders", label: "الطلبيات", color: "#bcd5fa" }, { key: "confirmed", label: "المؤكدة", color: "#2f80ed" }, { key: "cancelled", label: "الملغاة", color: "#cbd5e1" }, { key: "returned", label: "المرجعة", color: "#e5484d" }]} />
      </section>

      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
        <h2 className="p-4 font-extrabold text-navy">📦 أداء المنتجات</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="border-y border-line text-right text-xs text-muted"><tr><th className="p-3">المنتج</th><th className="p-3 text-center">طلبيات</th><th className="p-3 text-center">قطع</th><th className="p-3 text-center">تأكيد</th><th className="p-3 text-center">استلام</th><th className="p-3 text-center">إرجاع</th><th className="p-3">مداخيل مستلمة</th></tr></thead>
            <tbody className="divide-y divide-line">
              {d.products.map((p) => {
                const closed = p.delivered + p.returned;
                return (
                  <tr key={p.product_id} className="cursor-pointer hover:bg-soft/60" onClick={() => set({ product: p.product_id })}>
                    <td className="p-3">
                      <span className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.image ? <img src={p.image} alt="" loading="lazy" className="size-9 rounded-lg object-cover" /> : <span className="size-9 rounded-lg bg-soft" />}
                        <span className="line-clamp-1 font-bold">{p.product_name}</span>
                      </span>
                    </td>
                    <td className="p-3 text-center font-extrabold">{p.orders}</td>
                    <td className="p-3 text-center">{p.units}</td>
                    <td className="p-3 text-center">{p.orders ? Math.round((p.confirmed / p.orders) * 100) : 0}%</td>
                    <td className="p-3 text-center text-ok">{closed ? `${Math.round((p.delivered / closed) * 100)}%` : "—"}</td>
                    <td className="p-3 text-center text-sale">{p.returned}</td>
                    <td className="p-3 font-extrabold text-navy">{fmt(p.delivered_revenue)}</td>
                  </tr>
                );
              })}
              {d.products.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted">ما كانش بيانات فهاد الفترة</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
        <h2 className="p-4 font-extrabold text-navy">📍 الولايات</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="border-y border-line text-right text-xs text-muted"><tr><th className="p-3">الولاية</th><th className="p-3 text-center">طلبيات</th><th className="p-3 text-center">تبعثو</th><th className="p-3 text-center">مستلمة</th><th className="p-3 text-center">مرجعة</th><th className="p-3 text-center">نسبة الاستلام</th></tr></thead>
            <tbody className="divide-y divide-line">
              {d.wilayas.slice(0, 20).map((w) => { const closed = w.delivered + w.returned; const r = closed ? Math.round((w.delivered / closed) * 100) : null; return (
                <tr key={w.wilaya_code}><td className="p-3 font-bold">{w.wilaya_code} - {w.wilaya_name}</td><td className="p-3 text-center font-extrabold">{w.orders}</td><td className="p-3 text-center">{w.shipped}</td><td className="p-3 text-center text-ok">{w.delivered}</td><td className="p-3 text-center text-sale">{w.returned}</td>
                  <td className="p-3 text-center"><b className={r === null ? "text-muted" : r >= 70 ? "text-ok" : "text-sale"}>{r === null ? "—" : `${r}%`}</b></td></tr>
              ); })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function Page() { return <Suspense><Analytics /></Suspense>; }
