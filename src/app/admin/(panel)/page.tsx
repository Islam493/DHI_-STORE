"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmt } from "@/components/admin/api";
import OrderCard from "@/components/admin/OrderCard";
import type { Order } from "@/lib/order-types";

type Stats = {
  today: { count: number; revenue: number }; week: { count: number; revenue: number }; month: { count: number; revenue: number };
  pending: number; deliveryRate: number | null; latest: Order[];
};

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<Stats>("/api/admin/stats").then(setS).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="rounded-2xl bg-sale/10 p-4 font-semibold text-sale">{err}</p>;
  if (!s) return <p className="p-8 text-center text-muted">جاري التحميل...</p>;
  const cards = [
    ["اليوم", s.today], ["آخر 7 أيام", s.week], ["آخر 30 يوم", s.month],
  ] as const;
  return (
    <div className="space-y-6">
      {s.pending > 0 && (
        <Link href="/admin/orders?status=new" className="flex items-center justify-between rounded-2xl bg-brand p-4 font-bold text-white">
          <span>🔔 عندك {s.pending} طلبية جديدة لازم تأكدها</span><span>←</span>
        </Link>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([label, v]) => (
          <div key={label} className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <p className="text-xs font-bold text-muted">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-navy">{v.count} <span className="text-sm font-bold text-muted">طلبية</span></p>
            <p className="text-sm font-bold text-brand">{fmt(v.revenue)}</p>
          </div>
        ))}
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <p className="text-xs font-bold text-muted">نسبة الاستلام</p>
          <p className="mt-1 text-2xl font-extrabold text-navy">{s.deliveryRate === null ? "—" : `${s.deliveryRate}%`}</p>
          <p className="text-xs text-muted">مستلمة ÷ (مستلمة + راجعة)</p>
        </div>
      </div>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-navy">آخر الطلبيات</h2>
          <Link href="/admin/orders" className="text-sm font-bold text-brand">شوف الكل ←</Link>
        </div>
        {s.latest.length === 0 ? <p className="rounded-2xl bg-white p-8 text-center text-muted ring-1 ring-line">مازال ما جات حتى طلبية</p> : (
          <div className="grid gap-3 md:grid-cols-2">{s.latest.map((o) => <OrderCard key={o.id} o={o} />)}</div>
        )}
      </section>
    </div>
  );
}
