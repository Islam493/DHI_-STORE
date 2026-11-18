"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmt, timeAgo } from "@/components/admin/api";
import { Bars } from "@/components/admin/charts";
import { Skeleton, useMe } from "@/components/admin/ui";
import { actionLabel } from "@/components/admin/actions";
import { groups, statuses, type Order, type Status } from "@/lib/order-types";

type Period = { today: number; yesterday: number; week: number; month: number };
type Stats = {
  counts: Record<string, number>;
  today: { orders: number; yesterday: number; confirmed: number; cancelled: number };
  sales: { gross: Period; delivered: Period } | null;
  chart: { day: string; orders: number; confirmed: number; delivered: number }[];
  top: { product_id: string; product_name: string; orders: number; delivered: number; image: string | null }[];
  lowStock: { id: string; name: string; stock: number }[];
  latest: Order[];
  activity: { at: string; user_name: string; action: string; target: string | null }[];
};



function Card({ href, label, icon, n, tone, sub }: { href: string; label: string; icon: string; n: number | string; tone: string; sub?: string }) {
  return (
    <Link href={href} className="group rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-md hover:ring-brand">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted md:text-sm">{label}</p>
        <span className={`grid size-9 place-items-center rounded-xl text-lg ${tone}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-navy md:text-3xl">{typeof n === "number" ? n.toLocaleString("en-US") : n}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </Link>
  );
}

export default function Dashboard() {
  const me = useMe();
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<Stats>("/api/admin/stats").then(setS).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="rounded-2xl bg-sale/10 p-4 font-semibold text-sale">{err}</p>;
  if (!s) return <div className="space-y-4"><Skeleton rows={2} className="h-28" /><Skeleton rows={3} className="h-40" /></div>;
  const c = s.counts;
  const sum = (l: Status[]) => l.reduce((a, k) => a + (c[k] || 0), 0);
  const diff = s.today.orders - s.today.yesterday;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">مرحبا {me?.name} 👋</h1>
          <p className="text-sm text-muted">اليوم: <b>{s.today.orders}</b> طلبية {diff !== 0 && <span className={diff > 0 ? "text-ok" : "text-sale"}>({diff > 0 ? "▲" : "▼"} {Math.abs(diff)} على الأمس)</span>} · ✅ {s.today.confirmed} مؤكدة · ❌ {s.today.cancelled} ملغاة</p>
        </div>
        {(c.new || 0) > 0 && <Link href="/admin/orders?status=new" className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow-lg shadow-brand/30">🔔 {c.new} طلبية جديدة ←</Link>}
      </div>

      {/* حالات الطلبيات */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card href="/admin/orders" label="كل الطلبيات" icon="📋" n={c.all || 0} tone="bg-soft" />
        <Card href="/admin/orders?status=new" label="جديدة" icon="🆕" n={c.new || 0} tone="bg-sky-100" />
        <Card href="/admin/orders?status=pending" label="تستنى التأكيد" icon="⏳" n={sum(groups.pending)} tone="bg-amber-100" sub="جديدة + ما ردّش + مؤجلة..." />
        <Card href="/admin/orders?status=confirmed" label="مؤكدة" icon="✅" n={c.confirmed || 0} tone="bg-teal-100" />
        <Card href="/admin/orders?status=preparing" label="قيد التحضير" icon="📦" n={(c.preparing || 0) + (c.ready || 0)} tone="bg-indigo-100" sub={`منها ${c.ready || 0} جاهزة`} />
        <Card href="/admin/orders?status=shipped" label="عند التوصيل" icon="🚚" n={c.shipped || 0} tone="bg-violet-100" />
        <Card href="/admin/orders?status=delivered" label="مكتملة" icon="🎉" n={c.delivered || 0} tone="bg-green-100" />
        <Card href="/admin/orders?status=cancelled_all" label="ملغاة" icon="❌" n={sum(groups.cancelled)} tone="bg-gray-200" sub="ملغاة + مزيف + مكرر" />
        <Card href="/admin/orders?status=returned" label="مرجعة" icon="↩️" n={c.returned || 0} tone="bg-red-100" />
        {s.sales && <Card href="/admin/analytics" label="مداخيل مستلمة (30 يوم)" icon="💰" n={fmt(s.sales.delivered.month)} tone="bg-amber-100" />}
      </div>

      {s.sales && (
        <section className="grid gap-3 sm:grid-cols-3">
          {([["اليوم", "today"], ["آخر 7 أيام", "week"], ["آخر 30 يوم", "month"]] as const).map(([l, k]) => (
            <div key={k} className="rounded-2xl bg-gradient-to-l from-navy to-navy-2 p-4 text-white">
              <p className="text-sm font-bold text-white/70">💵 مبيعات {l}</p>
              <p className="mt-1 text-2xl font-extrabold">{fmt(s.sales!.gross[k])}</p>
              <p className="text-xs text-white/60">منها مستلمة: {fmt(s.sales!.delivered[k])}</p>
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line lg:col-span-2">
          <h2 className="mb-4 font-extrabold text-navy">📈 الطلبيات — آخر 14 يوم</h2>
          <Bars data={s.chart} series={[{ key: "orders", label: "الطلبيات", color: "#bcd5fa" }, { key: "confirmed", label: "المؤكدة", color: "#2f80ed" }, { key: "delivered", label: "المستلمة", color: "#12a150" }]} />
        </section>
        <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
          <h2 className="mb-3 font-extrabold text-navy">🔥 الأكثر مبيعا <span className="text-xs font-normal text-muted">30 يوم</span></h2>
          {s.top.length === 0 ? <p className="py-6 text-center text-sm text-muted">مازال ما كانش طلبيات</p> : (
            <ul className="space-y-3">
              {s.top.map((p, i) => (
                <li key={p.product_id} className="flex items-center gap-3">
                  <span className="w-4 text-xs font-extrabold text-muted">{i + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.image ? <img src={p.image} alt="" className="size-10 rounded-xl object-cover" /> : <span className="size-10 rounded-xl bg-soft" />}
                  <p className="min-w-0 flex-1 truncate text-sm font-bold">{p.product_name}</p>
                  <span className="text-left text-xs"><b className="block text-navy">{p.orders}</b><span className="text-ok">✅{p.delivered}</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line lg:col-span-2">
          <div className="flex items-center justify-between p-4"><h2 className="font-extrabold text-navy">🧾 آخر الطلبيات</h2><Link href="/admin/orders" className="text-sm font-bold text-brand">الكل ←</Link></div>
          {s.latest.length === 0 ? <p className="p-8 text-center text-muted">مازال ما جات حتى طلبية</p> : (
            <ul className="divide-y divide-line">
              {s.latest.map((o) => { const st = statuses[o.status as Status] || statuses.new; return (
                <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-soft">
                  <div className="min-w-0 flex-1"><p className="truncate font-bold text-navy">{o.customer_name} <span className="text-xs font-normal text-muted">· {o.wilaya_name}</span></p><p className="truncate text-xs text-muted">{o.product_name} · {timeAgo(o.created_at)}</p></div>
                  <span className={`hidden rounded-full px-2.5 py-1 text-xs font-bold sm:inline ${st.color}`}>{st.icon} {st.label}</span>
                  <span className="text-sm font-extrabold text-brand">{fmt(o.total)}</span>
                </Link></li>
              ); })}
            </ul>
          )}
        </section>
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
            <div className="mb-2 flex items-center justify-between"><h2 className="font-extrabold text-navy">🏬 تنبيهات المخزون</h2><Link href="/admin/inventory" className="text-xs font-bold text-brand">المخزون ←</Link></div>
            {s.lowStock.length === 0 ? <p className="py-3 text-center text-sm text-muted">ما كانش تنبيهات 👌</p> : (
              <ul className="space-y-1.5 text-sm">{s.lowStock.map((p) => <li key={p.id} className="flex justify-between gap-2"><span className="truncate">{p.stock === 0 ? "⛔" : "⚠️"} {p.name}</span><b className="text-sale">{p.stock}</b></li>)}</ul>
            )}
          </section>
          {s.activity.length > 0 && (
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
              <div className="mb-2 flex items-center justify-between"><h2 className="font-extrabold text-navy">🕓 آخر النشاط</h2><Link href="/admin/activity" className="text-xs font-bold text-brand">السجل ←</Link></div>
              <ul className="space-y-2 text-xs">{s.activity.map((a, i) => <li key={i} className="flex justify-between gap-2"><span className="truncate"><b>{a.user_name}</b> {actionLabel(a.action)}</span><span className="shrink-0 text-muted">{timeAgo(a.at)}</span></li>)}</ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
