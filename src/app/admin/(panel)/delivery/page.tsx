"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/admin/api";
import SaveBar from "@/components/admin/SaveBar";
import Link from "next/link";
import { timeAgo, fmt } from "@/components/admin/api";
import { useCan } from "@/components/admin/ui";
import { statuses, type Order, type Status } from "@/lib/order-types";

type Report = { shipments: Order[]; total: number; page: number; counts: { shipped: number; delivered: number; returned: number }; wilayas: { wilaya_code: number; wilaya_name: string; shipped: number; delivered: number; returned: number }[] };
import type { Wilaya } from "@/lib/wilayas";

type Row = { code: number; name: string; home: string; desk: string };

export default function Delivery() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [carrier, setCarrier] = useState(false);
  const [weLive, setWeLive] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulk, setBulk] = useState({ home: "", desk: "" });
  const [rep, setRep] = useState<Report | null>(null);
  const [st, setSt] = useState("");
  const [tab, setTab] = useState<"ships" | "perf" | "fees">("ships");
  const can = useCan();
  const loadRep = (status = st, page = 1) => api<Report>(`/api/admin/shipping/report?status=${status}&page=${page}`).then(setRep).catch(() => {});
  useEffect(() => { loadRep(); }, [st]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api<{ wilayas: Wilaya[]; live: Wilaya[]; carrier: boolean }>("/api/admin/settings").then((d) => {
      setCarrier(d.carrier);
      setWeLive(d.live.filter((l, i) => l.home !== d.wilayas[i]?.home || l.desk !== d.wilayas[i]?.desk).length);
      setRows(d.wilayas.map((w) => ({ code: w.code, name: w.name, home: String(w.home), desk: w.desk === null ? "" : String(w.desk) })));
    }).catch((e) => setMsg({ ok: false, text: e.message }));
  }, []);
  if (!rows) return <p className="p-8 text-center text-muted">{msg?.text || "جاري التحميل..."}</p>;
  const setRow = (code: number, k: "home" | "desk", v: string) => setRows(rows.map((r) => (r.code === code ? { ...r, [k]: v.replace(/\D/g, "") } : r)));

  async function save() {
    setSaving(true); setMsg(null);
    const fees = Object.fromEntries(rows!.map((r) => [r.code, { home: Number(r.home || 0), desk: r.desk === "" ? null : Number(r.desk) }]));
    try { await api("/api/admin/settings", { method: "PUT", body: JSON.stringify({ fees }) }); setMsg({ ok: true, text: "✅ تحفظت الأسعار! الموقع تحدّث." }); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setSaving(false);
  }

  const input = "w-full rounded-xl border border-line bg-white px-2 py-2.5 text-center text-base outline-none focus:border-brand";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-navy">🚚 التوصيل</h1>
      <section className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
        <span className="grid size-12 place-items-center rounded-xl bg-violet-100 text-2xl">🚚</span>
        <div className="flex-1">
          <p className="font-extrabold text-navy">World Express</p>
          <p className="text-xs text-muted">world-express.ecotrack.dz</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${carrier ? "bg-ok/10 text-ok" : "bg-gray-200 text-gray-600"}`}>{carrier ? "● مربوطة" : "○ ماشي مربوطة"}</span>
      </section>

      <div className="flex gap-2">
        {([["ships", "📦 الطرود"], ["perf", "📍 الأداء حسب الولاية"], ["fees", "💰 الأسعار"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-2 text-sm font-bold ring-1 ${tab === k ? "bg-navy text-white ring-navy" : "bg-white ring-line"}`}>{l}</button>
        ))}
      </div>

      {tab === "ships" && rep && (
        <section className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {([["shipped", "🚚 عند التوصيل"], ["delivered", "🎉 مستلمة"], ["returned", "↩️ مرجعة"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setSt(st === k ? "" : k)} className={`rounded-2xl bg-white p-4 text-right ring-1 ${st === k ? "ring-2 ring-brand" : "ring-line"}`}>
                <p className="text-xs font-bold text-muted">{l}</p><p className="mt-1 text-2xl font-extrabold text-navy">{rep.counts[k]}</p>
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
            {rep.shipments.length === 0 ? <p className="p-8 text-center text-muted">مازال ما بعثت حتى طرد بـ World Express من اللوحة</p> : (
              <ul className="divide-y divide-line">
                {rep.shipments.map((o) => { const s = statuses[o.status as Status] || statuses.new; return (
                  <li key={o.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <Link href={`/admin/orders/${o.id}`} className="min-w-0 flex-1"><b className="text-navy">{o.customer_name}</b> <span className="text-xs text-muted">· {o.wilaya_name} · {timeAgo(o.shipped_at || o.created_at)}</span></Link>
                    <a href={`https://suivi.ecotrack.dz/suivi/${o.tracking}`} target="_blank" rel="noopener noreferrer" className="font-bold text-violet-700 underline" dir="ltr">{o.tracking}</a>
                    <a href={`/api/admin/shipping/label?tracking=${o.tracking}`} target="_blank" className="rounded-lg bg-violet-100 px-2 py-1 text-xs font-bold text-violet-700">🖨️</a>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.color}`}>{s.icon} {s.label}</span>
                    <b>{fmt(o.total)}</b>
                  </li>
                ); })}
              </ul>
            )}
          </div>
          {rep.total > 25 && (
            <div className="flex justify-center gap-2">
              <button disabled={rep.page <= 1} onClick={() => loadRep(st, rep.page - 1)} className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold ring-1 ring-line disabled:opacity-40">→</button>
              <span className="text-sm text-muted">{rep.page} / {Math.ceil(rep.total / 25)}</span>
              <button disabled={rep.page * 25 >= rep.total} onClick={() => loadRep(st, rep.page + 1)} className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold ring-1 ring-line disabled:opacity-40">←</button>
            </div>
          )}
          <p className="text-xs text-muted">💡 الحالة (مستلمة / مرجعة) تبدّلها انت فالطلبية كي World Express تعلمك. المتابعة الأوتوماتيكية تحتاج API التتبع تاعهم (شوف التقرير).</p>
        </section>
      )}

      {tab === "perf" && rep && (
        <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
          <p className="p-4 text-sm text-muted">آخر 90 يوم — الطلبيات اللي تبعثو</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead className="border-y border-line text-right text-xs text-muted"><tr><th className="p-3">الولاية</th><th className="p-3 text-center">تبعثو</th><th className="p-3 text-center">مستلمة</th><th className="p-3 text-center">مرجعة</th><th className="p-3 text-center">نسبة الاستلام</th></tr></thead>
              <tbody className="divide-y divide-line">
                {rep.wilayas.filter((w) => w.shipped).sort((a, b) => b.shipped - a.shipped).map((w) => { const c = w.delivered + w.returned; const r = c ? Math.round((w.delivered / c) * 100) : null; return (
                  <tr key={w.wilaya_code}><td className="p-3 font-bold">{w.wilaya_code} - {w.wilaya_name}</td><td className="p-3 text-center">{w.shipped}</td><td className="p-3 text-center text-ok">{w.delivered}</td><td className="p-3 text-center text-sale">{w.returned}</td>
                    <td className="p-3 text-center"><b className={r === null ? "text-muted" : r >= 70 ? "text-ok" : "text-sale"}>{r === null ? "—" : `${r}%`}</b></td></tr>
                ); })}
                {!rep.wilayas.some((w) => w.shipped) && <tr><td colSpan={5} className="p-6 text-center text-muted">مازال ما كانش طرود</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "fees" && <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
        <h2 className="font-extrabold text-navy">💰 أسعار التوصيل</h2>
        {weLive > 0
          ? <p className="mb-3 rounded-xl bg-ok/10 p-3 text-sm font-bold text-ok">✅ الزبون يشوف أسعار World Express أوتوماتيك (تتبدل من صفحة 💹 الأرباح). هادو الأسعار اليدوية يخدمو غير إذا World Express ما ردّتش.</p>
          : <p className="mb-3 text-xs text-muted">هادو الأسعار يبانو للزبون فالفورم. خلي «للمكتب» فارغ إذا ما كانش مكتب فالولاية.</p>}
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl bg-soft p-3">
          <span className="w-full text-sm font-bold">نفس السعر لكل الولايات:</span>
          <input className={`${input} w-28`} inputMode="numeric" placeholder="للدار" value={bulk.home} onChange={(e) => setBulk({ ...bulk, home: e.target.value.replace(/\D/g, "") })} />
          <input className={`${input} w-28`} inputMode="numeric" placeholder="للمكتب" value={bulk.desk} onChange={(e) => setBulk({ ...bulk, desk: e.target.value.replace(/\D/g, "") })} />
          <button type="button" onClick={() => setRows(rows.map((r) => ({ ...r, home: bulk.home || r.home, desk: bulk.desk || r.desk })))} className="rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-white">تطبيق</button>
        </div>
        <div className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center gap-2 text-sm md:grid-cols-[1fr_7rem_7rem_1fr_7rem_7rem]">
          {[0, 1].map((c) => <div key={c} className={`contents ${c ? "max-md:hidden" : ""}`}><span className="font-bold text-muted">الولاية</span><span className="text-center font-bold text-muted">🏠 للدار</span><span className="text-center font-bold text-muted">🏢 للمكتب</span></div>)}
          {rows.map((r) => (
            <div key={r.code} className="contents">
              <span className="truncate">{String(r.code).padStart(2, "0")} {r.name}</span>
              <input className={input} inputMode="numeric" value={r.home} onChange={(e) => setRow(r.code, "home", e.target.value)} />
              <input className={input} inputMode="numeric" value={r.desk} placeholder="—" onChange={(e) => setRow(r.code, "desk", e.target.value)} />
            </div>
          ))}
        </div>
      </section>}
      {tab === "fees" && can("shipping.edit") && <SaveBar onSave={save} saving={saving} msg={msg} />}
    </div>
  );
}
