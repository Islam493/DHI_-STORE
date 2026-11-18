"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/components/admin/api";
import OrderCard from "@/components/admin/OrderCard";
import { statuses, type Order } from "@/lib/order-types";

function Orders() {
  const router = useRouter();
  const sp = useSearchParams();
  const status = sp.get("status") || "";
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [carrier, setCarrier] = useState(false);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async (offset = 0, search = q) => {
    setLoading(true); setErr("");
    try {
      const p = new URLSearchParams({ status, q: search, offset: String(offset) });
      const d = await api<{ orders: Order[]; counts: Record<string, number>; carrier: boolean }>(`/api/admin/orders?${p}`);
      setCarrier(d.carrier);
      setOrders((prev) => (offset ? [...prev, ...d.orders] : d.orders));
      setCounts(d.counts); setMore(d.orders.length === 50);
    } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, [status, q]);

  useEffect(() => { load(0); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs: [string, string][] = [["", "الكل"], ...Object.entries(statuses).map(([k, v]) => [k, v.label] as [string, string])];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-navy">🛒 الطلبيات</h1>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => router.push(k ? `/admin/orders?status=${k}` : "/admin/orders")}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ring-1 ${status === k ? "bg-navy text-white ring-navy" : "bg-white text-muted ring-line"}`}>
            {label} <span className="opacity-70">{counts[k || "all"] ?? 0}</span>
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(0); }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="قلّب بالاسم، الرقم، البلدية..." className="flex-1 rounded-xl border border-line bg-white px-4 py-2.5 outline-none focus:border-brand" />
        <button className="rounded-xl bg-brand px-4 font-bold text-white">بحث</button>
      </form>
      {err && <p className="rounded-2xl bg-sale/10 p-4 font-semibold text-sale">{err}</p>}
      {!loading && orders.length === 0 && !err && <p className="rounded-2xl bg-white p-8 text-center text-muted ring-1 ring-line">ما كانش طلبيات هنا</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {orders.map((o) => <OrderCard key={o.id} o={o} carrier={carrier} onChange={() => load(0)} />)}
      </div>
      {loading && <p className="p-4 text-center text-muted">جاري التحميل...</p>}
      {more && !loading && <button onClick={() => load(orders.length)} className="w-full rounded-xl bg-white py-3 font-bold text-brand ring-1 ring-line">عرض المزيد</button>}
    </div>
  );
}

export default function Page() { return <Suspense><Orders /></Suspense>; }
