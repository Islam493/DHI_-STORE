"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/admin/api";
import SaveBar from "@/components/admin/SaveBar";
import type { Wilaya } from "@/lib/wilayas";

type Row = { code: number; name: string; home: string; desk: string };

export default function Delivery() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [carrier, setCarrier] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulk, setBulk] = useState({ home: "", desk: "" });

  useEffect(() => {
    api<{ wilayas: Wilaya[]; carrier: boolean }>("/api/admin/settings").then((d) => {
      setCarrier(d.carrier);
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

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
        <h2 className="font-extrabold text-navy">💰 أسعار التوصيل</h2>
        <p className="mb-3 text-xs text-muted">هادو الأسعار يبانو للزبون فالفورم. خلي «للمكتب» فارغ إذا ما كانش مكتب فالولاية.</p>
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
      </section>
      <SaveBar onSave={save} saving={saving} msg={msg} />
    </div>
  );
}
