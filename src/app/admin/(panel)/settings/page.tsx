"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/admin/api";
import type { Wilaya } from "@/lib/wilayas";

type Row = { code: number; name: string; home: string; desk: string };

export default function Settings() {
  const [whatsapp, setWhatsapp] = useState("");
  const [phone, setPhone] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulk, setBulk] = useState({ home: "", desk: "" });

  useEffect(() => {
    api<{ whatsapp: string; phone: string; wilayas: Wilaya[] }>("/api/admin/settings").then((d) => {
      setWhatsapp(d.whatsapp); setPhone(d.phone);
      setRows(d.wilayas.map((w) => ({ code: w.code, name: w.name, home: String(w.home), desk: w.desk === null ? "" : String(w.desk) })));
    }).catch((e) => setMsg({ ok: false, text: e.message }));
  }, []);

  if (!rows) return <p className="p-8 text-center text-muted">{msg?.text || "جاري التحميل..."}</p>;
  const setRow = (code: number, k: "home" | "desk", v: string) => setRows(rows.map((r) => (r.code === code ? { ...r, [k]: v.replace(/\D/g, "") } : r)));

  async function save() {
    setSaving(true); setMsg(null);
    const fees = Object.fromEntries(rows!.map((r) => [r.code, { home: Number(r.home || 0), desk: r.desk === "" ? null : Number(r.desk) }]));
    try {
      await api("/api/admin/settings", { method: "PUT", body: JSON.stringify({ whatsapp, phone, fees }) });
      setMsg({ ok: true, text: "✅ تحفظ! الموقع تحدّث." });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setSaving(false);
  }

  const input = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base outline-none focus:border-brand";
  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-xl font-extrabold text-navy">⚙️ الإعدادات</h1>
      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="font-extrabold text-navy">📞 التواصل</h2>
        <div><label className="mb-1 block text-sm font-bold">رقم الواتساب</label>
          <input className={input} dir="ltr" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="0555123456" />
          <p className="mt-1 text-xs text-muted">زر الواتساب فالموقع يبعث لهاد الرقم</p></div>
        <div><label className="mb-1 block text-sm font-bold">رقم الهاتف (يبان للزبائن)</label>
          <input className={input} dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0555 12 34 56" /></div>
      </section>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="font-extrabold text-navy">🚚 أسعار التوصيل</h2>
        <p className="mb-3 text-xs text-muted">خلي «للمكتب» فارغ إذا ما كانش مكتب فالولاية</p>
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl bg-soft p-3">
          <span className="w-full text-sm font-bold">تطبيق نفس السعر على كل الولايات:</span>
          <input className={`${input} w-28`} inputMode="numeric" placeholder="للدار" value={bulk.home} onChange={(e) => setBulk({ ...bulk, home: e.target.value.replace(/\D/g, "") })} />
          <input className={`${input} w-28`} inputMode="numeric" placeholder="للمكتب" value={bulk.desk} onChange={(e) => setBulk({ ...bulk, desk: e.target.value.replace(/\D/g, "") })} />
          <button type="button" onClick={() => setRows(rows.map((r) => ({ ...r, home: bulk.home || r.home, desk: bulk.desk || r.desk })))} className="rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-white">تطبيق</button>
        </div>
        <div className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center gap-2 text-sm">
          <span className="font-bold text-muted">الولاية</span><span className="text-center font-bold text-muted">🏠 للدار</span><span className="text-center font-bold text-muted">🏢 للمكتب</span>
          {rows.map((r) => (
            <div key={r.code} className="contents">
              <span className="truncate">{String(r.code).padStart(2, "0")} {r.name}</span>
              <input className={`${input} px-2 text-center`} inputMode="numeric" value={r.home} onChange={(e) => setRow(r.code, "home", e.target.value)} />
              <input className={`${input} px-2 text-center`} inputMode="numeric" value={r.desk} placeholder="—" onChange={(e) => setRow(r.code, "desk", e.target.value)} />
            </div>
          ))}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-line bg-white/95 p-3 backdrop-blur md:bottom-0">
        <div className="mx-auto max-w-5xl">
          {msg && <p className={`mb-2 rounded-xl p-2 text-sm font-semibold ${msg.ok ? "bg-ok/10 text-ok" : "bg-sale/10 text-sale"}`}>{msg.text}</p>}
          <button onClick={save} disabled={saving} className="w-full rounded-xl bg-brand py-3.5 text-lg font-extrabold text-white disabled:opacity-50">{saving ? "جاري الحفظ..." : "💾 حفظ"}</button>
        </div>
      </div>
    </div>
  );
}
