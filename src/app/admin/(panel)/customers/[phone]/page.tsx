"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { api, fmt, timeAgo } from "@/components/admin/api";
import { Skeleton, toast } from "@/components/admin/ui";
import { statuses, type Order, type Status } from "@/lib/order-types";

type C = { phone: string; name: string; wilaya: string; commune: string; address: string; orders: number; delivered: number; cancelled: number; returned: number; spent: number; first: string; last: string; blocked: boolean };

export default function CustomerPage({ params }: { params: Promise<{ phone: string }> }) {
  const { phone } = use(params);
  const [d, setD] = useState<{ customer: C; note: string; orders: Order[] } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<{ customer: C; note: string; orders: Order[] }>(`/api/admin/customers/${phone}`).then(setD).catch((e) => setErr(e.message)); }, [phone]);
  if (err) return <p className="rounded-2xl bg-sale/10 p-4 font-semibold text-sale">{err}</p>;
  if (!d) return <Skeleton rows={4} className="h-24" />;
  const c = d.customer;
  const closed = c.delivered + c.returned;
  const wa = `https://wa.me/${c.phone.replace(/^0/, "213")}`;

  async function saveNote() {
    try { await api(`/api/admin/customers/${phone}`, { method: "PUT", body: JSON.stringify({ note }) }); setD({ ...d!, note: note || "" }); setNote(null); toast("تحفظت الملاحظة"); }
    catch (e) { toast((e as Error).message, false); }
  }

  return (
    <div className="space-y-4">
      <Link href="/admin/customers" className="inline-block rounded-xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-line">→ رجوع للزبائن</Link>
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-line">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-16 place-items-center rounded-full bg-brand/10 text-2xl font-extrabold text-brand">{c.name.slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold text-navy">{c.name} {c.blocked && <span className="rounded-full bg-sale/10 px-2 py-0.5 text-xs text-sale">🚫 محظور</span>}</h1>
            <p className="text-sm text-muted">{c.wilaya} / {c.commune} · {c.address}</p>
            <p className="text-xs text-muted">زبون من {timeAgo(c.first)} · آخر طلبية {timeAgo(c.last)}</p>
          </div>
          <div className="flex gap-2">
            <a href={`tel:${c.phone}`} className="rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-white" dir="ltr">📞 {c.phone}</a>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-wa px-4 py-2.5 text-sm font-bold text-white">💬 واتساب</a>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[["🛒 الطلبيات", c.orders], ["✅ مكتملة", c.delivered], ["❌ ملغاة", c.cancelled], ["↩️ مرجعة", c.returned], ["💰 الصرف", fmt(c.spent)]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-soft p-3"><p className="text-xs font-bold text-muted">{l}</p><p className="mt-1 text-lg font-extrabold text-navy">{v}</p></div>
          ))}
        </div>
        {closed > 0 && <p className="mt-3 text-sm">نسبة الاستلام: <b className={c.delivered / closed >= 0.7 ? "text-ok" : "text-sale"}>{Math.round((c.delivered / closed) * 100)}%</b></p>}
      </section>

      <section className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
        <h2 className="mb-2 font-extrabold text-amber-900">📝 ملاحظات على الزبون</h2>
        <textarea rows={3} value={note ?? d.note} onChange={(e) => setNote(e.target.value)} placeholder="مثلا: زبون مليح، يحب التوصيل للمكتب..." className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none" />
        {note !== null && note !== d.note && <button onClick={saveNote} className="mt-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white">💾 حفظ</button>}
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line">
        <h2 className="p-4 font-extrabold text-navy">🧾 كل الطلبيات ({d.orders.length})</h2>
        <ul className="divide-y divide-line">
          {d.orders.map((o) => { const st = statuses[o.status as Status] || statuses.new; return (
            <li key={o.id}>
              <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-soft">
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{o.product_name} ×{o.quantity}</span><span className="text-xs text-muted" dir="ltr">#{o.id}</span> <span className="text-xs text-muted">· {timeAgo(o.created_at)}</span></span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${st.color}`}>{st.icon} {st.label}</span>
                <span className="font-extrabold text-navy">{fmt(o.total)}</span>
              </Link>
            </li>
          ); })}
        </ul>
      </section>
    </div>
  );
}
