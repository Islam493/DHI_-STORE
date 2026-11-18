"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmt, timeAgo } from "@/components/admin/api";
import { statuses, type Order, type Status } from "@/lib/order-types";

type Card = { today: number; yesterday: number };
type Stats = {
  cards: { orders: Card; confirmed: Card; cancelled: Card; revenue: Card };
  pending: number;
  month: { orders: number; confirmRate: number | null; deliveryRate: number | null };
  chart: { day: string; orders: number; confirmed: number }[];
  top: { id: string; name: string; image: string | null; orders: number; share: number }[];
  latest: Order[];
};

function StatCard({ label, icon, c, money, tone }: { label: string; icon: string; c: Card; money?: boolean; tone: string }) {
  const f = (n: number) => (money ? fmt(n) : n.toLocaleString("en-US"));
  const diff = c.today - c.yesterday;
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-muted">{label}</p>
        <span className={`grid size-9 place-items-center rounded-xl text-lg ${tone}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-navy md:text-3xl">{f(c.today)}</p>
      <p className="mt-1 text-xs text-muted">
        الأمس: {f(c.yesterday)}
        {diff !== 0 && <span className={`mr-2 font-bold ${diff > 0 ? "text-ok" : "text-sale"}`}>{diff > 0 ? "▲" : "▼"}</span>}
      </p>
    </div>
  );
}

function Chart({ data }: { data: Stats["chart"] }) {
  const max = Math.max(1, ...data.map((d) => d.orders));
  return (
    <div>
      <div className="flex h-44 items-end gap-1.5" dir="ltr">
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
            <div className="relative w-full rounded-t-md bg-brand/20" style={{ height: `${(d.orders / max) * 100}%` }}>
              <div className="absolute inset-x-0 bottom-0 rounded-t-md bg-brand" style={{ height: `${d.orders ? (d.confirmed / d.orders) * 100 : 0}%` }} />
            </div>
            <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-navy px-2 py-1 text-[10px] font-bold text-white group-hover:block">{d.orders} / ✅{d.confirmed}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 text-[9px] text-muted" dir="ltr">{data.map((d, i) => <span key={d.day} className="flex-1 text-center">{i % 2 ? "" : d.day.slice(3)}</span>)}</div>
      <div className="mt-3 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1"><i className="size-3 rounded bg-brand/20" /> الطلبات</span>
        <span className="flex items-center gap-1"><i className="size-3 rounded bg-brand" /> المؤكدة</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<Stats>("/api/admin/stats").then(setS).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="rounded-2xl bg-sale/10 p-4 font-semibold text-sale">{err}</p>;
  if (!s) return <p className="p-8 text-center text-muted">جاري التحميل...</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-navy">مرحبا بيك 👋</h1>
        {s.pending > 0 && (
          <Link href="/admin/orders?status=new" className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow-lg shadow-brand/30">🔔 {s.pending} طلبية تستنى التأكيد ←</Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="طلبات اليوم" icon="🛒" c={s.cards.orders} tone="bg-sky-100" />
        <StatCard label="المؤكدة اليوم" icon="✅" c={s.cards.confirmed} tone="bg-teal-100" />
        <StatCard label="الملغاة اليوم" icon="❌" c={s.cards.cancelled} tone="bg-red-100" />
        <StatCard label="مبيعات مؤكدة اليوم" icon="💰" c={s.cards.revenue} money tone="bg-amber-100" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-extrabold text-navy">تحليل الطلبات <span className="text-xs font-semibold text-muted">— آخر 14 يوم</span></h2>
            <div className="flex gap-3 text-xs">
              <span className="rounded-full bg-soft px-3 py-1 font-bold">تأكيد: {s.month.confirmRate ?? "—"}%</span>
              <span className="rounded-full bg-soft px-3 py-1 font-bold">استلام: {s.month.deliveryRate ?? "—"}%</span>
            </div>
          </div>
          <Chart data={s.chart} />
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
          <h2 className="mb-3 font-extrabold text-navy">أبرز المنتجات <span className="text-xs font-semibold text-muted">— 30 يوم</span></h2>
          {s.top.length === 0 ? <p className="py-8 text-center text-sm text-muted">مازال ما كانش طلبيات</p> : (
            <ul className="space-y-3">
              {s.top.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.image ? <img src={p.image} alt="" className="size-11 rounded-xl object-cover" /> : <span className="size-11 rounded-xl bg-soft" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{p.name}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-brand" style={{ width: `${p.share}%` }} /></div>
                  </div>
                  <span className="text-xs font-bold text-muted">{p.orders}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-line">
        <div className="flex items-center justify-between p-4">
          <h2 className="font-extrabold text-navy">آخر الطلبات</h2>
          <Link href="/admin/orders" className="text-sm font-bold text-brand">شوف الكل ←</Link>
        </div>
        {s.latest.length === 0 ? <p className="p-8 text-center text-muted">مازال ما جات حتى طلبية</p> : (
          <ul className="divide-y divide-line">
            {s.latest.map((o) => {
              const st = statuses[o.status as Status] || statuses.new;
              return (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-soft">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-navy">{o.customer_name} <span className="text-xs font-normal text-muted">· {o.wilaya_name}</span></p>
                      <p className="truncate text-xs text-muted">{o.product_name} · {timeAgo(o.created_at)}</p>
                    </div>
                    <span className={`hidden rounded-full px-2.5 py-1 text-xs font-bold sm:inline ${st.color}`}>{st.icon} {st.label}</span>
                    <span className="text-sm font-extrabold text-brand">{fmt(o.total)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
