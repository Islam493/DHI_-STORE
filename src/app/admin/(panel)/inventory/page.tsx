"use client";
import { useCallback, useEffect, useState } from "react";
import { api, timeAgo } from "@/components/admin/api";
import { Empty, Skeleton, confirmAction, toast, useCan } from "@/components/admin/ui";

type P = { id: string; name: string; image: string | null; sku: string | null; stock: number | null; lowStock: number | null; active: boolean };
type M = { id: number; at: string; product_id: string; delta: number; stock_after: number | null; reason: string; ref: string | null; user_name: string | null };
type Res = { products: P[]; moves: M[]; total: number; page: number };

const reasons: Record<string, string> = {
  order: "🛒 طلبية", cancel: "❌ إلغاء (رجعت)", return: "↩️ مرجع (رجعت)", reactivate: "🔁 رجوع الطلبية", incoming: "📥 وصول سلعة",
  damaged: "🗑️ تالف", adjust: "✏️ تصحيح", initial: "🏁 بداية التتبع", "order-failed": "⚠️ فشل الطلب (رجعت)",
};
const kinds = [["incoming", "📥 وصول سلعة"], ["damaged", "🗑️ تالف / ضايع"], ["set", "✏️ تصحيح العدد"]] as const;

export default function Inventory() {
  const can = useCan();
  const [d, setD] = useState<Res | null>(null);
  const [filter, setFilter] = useState("");
  const [op, setOp] = useState<{ p: P; type: string } | null>(null);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"all" | "low" | "untracked">("all");

  const load = useCallback((product = filter, page = 1) => api<Res>(`/api/admin/inventory?product=${product}&page=${page}`).then(setD).catch((e) => toast(e.message, false)), [filter]);
  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run() {
    if (!op) return;
    setBusy(true);
    try {
      await api("/api/admin/inventory", { method: "POST", body: JSON.stringify({ product_id: op.p.id, type: op.type, qty: Number(qty), note }) });
      toast("تسجّل ✅"); setOp(null); setQty(""); setNote(""); load();
    } catch (e) { toast((e as Error).message, false); }
    setBusy(false);
  }
  async function disable(p: P) {
    if (!(await confirmAction(`توقف تتبع المخزون لـ «${p.name}»؟ المنتج يولي يتباع بلا حد.`))) return;
    try { await api("/api/admin/inventory", { method: "POST", body: JSON.stringify({ product_id: p.id, type: "disable" }) }); toast("توقف التتبع"); load(); } catch (e) { toast((e as Error).message, false); }
  }

  if (!d) return <Skeleton rows={6} className="h-20" />;
  const low = (p: P) => p.stock !== null && p.stock <= (p.lowStock ?? 3);
  const list = d.products.filter((p) => (view === "low" ? low(p) : view === "untracked" ? p.stock === null : true));
  const tracked = d.products.filter((p) => p.stock !== null);
  const pname = (id: string) => d.products.find((p) => p.id === id)?.name || id;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-navy">🏬 المخزون</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["متبوعين", tracked.length, "📦"], ["قليل", tracked.filter((p) => p.stock! > 0 && low(p)).length, "⚠️"], ["نافذ", tracked.filter((p) => p.stock! <= 0).length, "⛔"], ["مجموع القطع", tracked.reduce((a, p) => a + (p.stock || 0), 0), "🔢"]].map(([l, n, i]) => (
          <div key={l as string} className="rounded-2xl bg-white p-4 ring-1 ring-line"><p className="text-sm font-bold text-muted">{i} {l}</p><p className="mt-1 text-2xl font-extrabold text-navy">{Number(n).toLocaleString("en-US")}</p></div>
        ))}
      </div>

      <div className="flex gap-2">
        {([["all", "الكل"], ["low", "⚠️ قليل / نافذ"], ["untracked", "بلا تتبع"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} className={`rounded-full px-4 py-2 text-sm font-bold ring-1 ${view === k ? "bg-navy text-white ring-navy" : "bg-white ring-line"}`}>{l}</button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line">
        {list.length === 0 ? <div className="p-6"><Empty text="ما كانش منتجات هنا" /></div> : (
          <ul className="divide-y divide-line">
            {list.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.image ? <img src={p.image} alt="" loading="lazy" className="size-12 rounded-xl object-cover" /> : <span className="size-12 rounded-xl bg-soft" />}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-bold text-navy">{p.name}</p>
                  <p className="text-xs text-muted" dir="ltr">{p.sku || "—"}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-extrabold ${p.stock === null ? "bg-soft text-muted" : p.stock <= 0 ? "bg-sale/10 text-sale" : low(p) ? "bg-amber-100 text-amber-700" : "bg-ok/10 text-ok"}`}>
                  {p.stock === null ? "بلا تتبع" : p.stock <= 0 ? "⛔ نافذ" : `${p.stock} قطعة`}
                </span>
                {can("inventory.edit") && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.stock === null ? (
                      <button onClick={() => { setOp({ p, type: "enable" }); setQty(""); }} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white">▶️ ابدا التتبع</button>
                    ) : (<>
                      {kinds.map(([k, l]) => <button key={k} onClick={() => { setOp({ p, type: k }); setQty(k === "set" ? String(p.stock) : ""); }} className="rounded-lg bg-soft px-3 py-1.5 text-xs font-bold ring-1 ring-line">{l}</button>)}
                      <button onClick={() => setFilter(filter === p.id ? "" : p.id)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ring-1 ${filter === p.id ? "bg-navy text-white ring-navy" : "ring-line"}`}>🕓 السجل</button>
                      <button onClick={() => disable(p)} className="rounded-lg px-2 py-1.5 text-xs text-muted" title="إيقاف التتبع">⏹</button>
                    </>)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {op && (
        <div className="fixed inset-0 z-[65] grid place-items-center bg-black/40 p-4" onClick={() => setOp(null)}>
          <div className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-extrabold text-navy">{op.type === "enable" ? "▶️ ابدا تتبع المخزون" : kinds.find((k) => k[0] === op.type)?.[1]}</p>
            <p className="text-sm text-muted">{op.p.name}{op.p.stock !== null && <> — الحالي: <b>{op.p.stock}</b></>}</p>
            <input autoFocus inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder={op.type === "set" || op.type === "enable" ? "العدد الحقيقي اللي عندك" : "شحال من قطعة"} className="w-full rounded-xl border border-line px-4 py-3 text-lg outline-none focus:border-brand" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (مثلا: فاتورة المورد، رقم الطلبية...)" className="w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-brand" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={run} disabled={busy || qty === ""} className="rounded-xl bg-brand py-3 font-extrabold text-white disabled:opacity-50">{busy ? "..." : "✅ سجّل"}</button>
              <button onClick={() => setOp(null)} className="rounded-xl bg-soft py-3 font-bold">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-extrabold text-navy">🕓 حركات المخزون {filter && <span className="text-sm font-normal text-muted">— {pname(filter)}</span>}</h2>
          {filter && <button onClick={() => setFilter("")} className="text-xs font-bold text-brand">كل المنتجات</button>}
        </div>
        {d.moves.length === 0 ? <p className="py-6 text-center text-sm text-muted">مازال ما كانش حركات</p> : (
          <ul className="divide-y divide-line text-sm">
            {d.moves.map((m) => (
              <li key={m.id ?? m.at + m.ref} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className={`w-14 shrink-0 text-center font-extrabold ${m.delta > 0 ? "text-ok" : "text-sale"}`} dir="ltr">{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                <span className="font-bold">{reasons[m.reason] || m.reason}</span>
                {!filter && <span className="text-muted">· {pname(m.product_id)}</span>}
                {m.ref && <span className="text-xs text-muted" dir="ltr">· {m.ref}</span>}
                <span className="mr-auto text-xs text-muted">→ {m.stock_after ?? "—"} · {m.user_name} · {timeAgo(m.at)}</span>
              </li>
            ))}
          </ul>
        )}
        {d.total > 30 && (
          <div className="mt-3 flex justify-center gap-2">
            <button disabled={d.page <= 1} onClick={() => load(filter, d.page - 1)} className="rounded-lg bg-soft px-3 py-1.5 text-sm font-bold disabled:opacity-40">→</button>
            <span className="text-sm text-muted">{d.page} / {Math.ceil(d.total / 30)}</span>
            <button disabled={d.page * 30 >= d.total} onClick={() => load(filter, d.page + 1)} className="rounded-lg bg-soft px-3 py-1.5 text-sm font-bold disabled:opacity-40">←</button>
          </div>
        )}
      </section>
    </div>
  );
}
