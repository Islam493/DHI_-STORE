"use client";
import { useState } from "react";
import { api, fmt, timeAgo } from "./api";
import { statuses, type Order, type Status } from "@/lib/order-types";

export default function OrderCard({ o, onChange }: { o: Order; onChange?: (s: Status) => void }) {
  const [status, setStatus] = useState(o.status as Status);
  const [busy, setBusy] = useState(false);
  const st = statuses[status] || statuses.new;
  const wa = `https://wa.me/${o.phone.replace(/^0/, "213")}?text=${encodeURIComponent(`السلام عليكم ${o.customer_name}، معاك DHI Electronics بخصوص طلبيتك (${o.product_name}) — المجموع ${fmt(o.total)}. نأكدو الطلبية؟`)}`;

  async function change(s: Status) {
    const prev = status;
    setStatus(s); setBusy(true);
    try { await api("/api/admin/orders", { method: "PATCH", body: JSON.stringify({ id: o.id, status: s }) }); onChange?.(s); }
    catch (e) { setStatus(prev); alert((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className={`rounded-2xl bg-white p-4 ring-1 ring-line ${busy ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-extrabold text-navy">{o.customer_name}</p>
          <p className="text-xs text-muted"><span dir="ltr">#{o.id}</span> · {timeAgo(o.created_at)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${st.color}`}>{st.label}</span>
      </div>
      <div className="mt-3 space-y-1 text-sm">
        <p>📦 {o.product_name}{o.variant ? ` (${o.variant})` : ""} <b>× {o.quantity}</b></p>
        <p>📍 {o.wilaya_code} - {o.wilaya_name} / {o.commune}</p>
        <p>🚚 {o.delivery_method === "home" ? `للدار — ${o.address}` : "للمكتب"}</p>
        {o.note && <p className="rounded-lg bg-amber-50 p-2 text-amber-800">📝 {o.note}</p>}
        <p className="pt-1 text-base font-extrabold text-brand">💰 {fmt(o.total)} <span className="text-xs font-semibold text-muted">(توصيل {fmt(o.shipping_fee)})</span></p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={`tel:${o.phone}`} className="rounded-xl bg-navy py-2.5 text-center text-sm font-bold text-white">📞 <span dir="ltr">{o.phone}</span></a>
        <a href={wa} target="_blank" rel="noopener" className="rounded-xl bg-wa py-2.5 text-center text-sm font-bold text-white">💬 واتساب</a>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(Object.keys(statuses) as Status[]).map((s) => (
          <button key={s} disabled={busy || s === status} onClick={() => change(s)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 ${s === status ? "bg-navy text-white ring-navy" : "bg-white text-muted ring-line hover:ring-brand"}`}>
            {statuses[s].label}
          </button>
        ))}
      </div>
    </div>
  );
}
