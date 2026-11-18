"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/components/admin/api";
import { actionLabel } from "@/components/admin/actions";
import { Empty, NoAccess, Skeleton, toast, useCan, useMe } from "@/components/admin/ui";

type A = { id: number; at: string; user_name: string; action: string; target: string | null; details: Record<string, unknown> | null };

export default function Activity() {
  const can = useCan();
  const me = useMe();
  const [d, setD] = useState<{ rows: A[]; total: number; page: number } | null>(null);
  const [q, setQ] = useState("");
  const load = (page = 1, search = q) => api<{ rows: A[]; total: number; page: number }>(`/api/admin/audit?page=${page}&q=${encodeURIComponent(search)}`).then(setD).catch((e) => toast(e.message, false));
  useEffect(() => { if (me && can("audit.view")) load(); }, [me]); // eslint-disable-line react-hooks/exhaustive-deps
  if (me && !can("audit.view")) return <NoAccess />;

  const link = (a: A) => (a.action.startsWith("order.") && a.target && !a.target.includes(",") ? `/admin/orders/${a.target}` : a.action === "customer.note" && a.target ? `/admin/customers/${a.target}` : null);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-navy">🕓 سجل النشاط</h1>
      <p className="text-sm text-muted">كل عملية مهمة تتسجل هنا: شكون، واش دار، ووقتاش.</p>
      <form onSubmit={(e) => { e.preventDefault(); load(1); }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 الاسم، العملية، رقم الطلبية..." className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand" />
        <button className="rounded-xl bg-navy px-4 text-sm font-bold text-white">بحث</button>
      </form>
      {!d ? <Skeleton rows={8} className="h-12" /> : d.rows.length === 0 ? <Empty icon="🕓" text="مازال ما كانش نشاط مسجل" /> : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line">
          {d.rows.map((a) => { const href = link(a); return (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <b className="text-navy">{a.user_name}</b>
              <span>{actionLabel(a.action)}</span>
              {a.target && (href ? <Link href={href} className="font-bold text-brand" dir="ltr">#{a.target}</Link> : <span className="text-xs text-muted" dir="ltr">{a.target.slice(0, 60)}</span>)}
              {a.details?.status ? <span className="rounded-full bg-soft px-2 py-0.5 text-xs">→ {String(a.details.status)}</span> : null}
              <span className="mr-auto text-xs text-muted" dir="ltr">{new Date(a.at).toLocaleString("fr-DZ", { timeZone: "Africa/Algiers" })}</span>
            </li>
          ); })}
        </ul>
      )}
      {d && d.total > 50 && (
        <div className="flex justify-center gap-2">
          <button disabled={d.page <= 1} onClick={() => load(d.page - 1)} className="rounded-lg bg-white px-3 py-2 text-sm font-bold ring-1 ring-line disabled:opacity-40">→</button>
          <span className="py-2 text-sm text-muted">{d.page} / {Math.ceil(d.total / 50)}</span>
          <button disabled={d.page * 50 >= d.total} onClick={() => load(d.page + 1)} className="rounded-lg bg-white px-3 py-2 text-sm font-bold ring-1 ring-line disabled:opacity-40">←</button>
        </div>
      )}
    </div>
  );
}
