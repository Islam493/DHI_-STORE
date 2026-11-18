"use client";
import { useEffect, useMemo, useState } from "react";
import { api, fmt } from "./api";
import type { Order } from "@/lib/order-types";

type Commune = { name: string; desk: boolean };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[ً-ٟ]/g, "").replace(/[^a-z0-9؀-ۿ]/g, "");

// قبل ما نبعثو: نختارو البلدية من لستة World Express (لازم تكون نفس الاسم عندهم)
export default function ShipPanel({ o, onDone, onCancel }: { o: Order; onDone: (tracking: string) => void; onCancel: () => void }) {
  const [list, setList] = useState<Commune[] | null>(null);
  const [commune, setCommune] = useState("");
  const [desk, setDesk] = useState(o.delivery_method === "desk");
  const [montant, setMontant] = useState(String(o.total));
  const [remarque, setRemarque] = useState(o.note || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ communes: Commune[] }>(`/api/admin/shipping/communes?wilaya=${o.wilaya_code}`).then(({ communes }) => {
      setList(communes);
      const want = norm(o.commune);
      const hit = communes.find((c) => norm(c.name) === want) || communes.find((c) => want && (norm(c.name).includes(want) || want.includes(norm(c.name))));
      if (hit) setCommune(hit.name);
    }).catch((e) => setErr(e.message));
  }, [o.wilaya_code, o.commune]);

  const deskOk = useMemo(() => !list || list.find((c) => c.name === commune)?.desk !== false, [list, commune]);

  async function send() {
    setBusy(true); setErr("");
    try {
      const r = await api<{ tracking: string }>("/api/admin/shipping/send", {
        method: "POST", body: JSON.stringify({ id: o.id, commune, montant: Number(montant), remarque, stop_desk: desk ? 1 : 0 }),
      });
      onDone(r.tracking);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-violet-600";
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-violet-50 p-3 text-sm ring-1 ring-violet-200">
      <p className="font-extrabold text-violet-800">🚚 إرسال لـ World Express</p>
      <div>
        <label className="mb-1 block text-xs font-bold">البلدية <span className="font-normal text-muted">(الزبون كتب: «{o.commune}»)</span></label>
        {list ? (
          <select className={input} value={commune} onChange={(e) => setCommune(e.target.value)}>
            <option value="">— اختار البلدية —</option>
            {list.map((c) => <option key={c.name} value={c.name}>{c.name}{c.desk ? " 🏢" : ""}</option>)}
          </select>
        ) : !err && <p className="text-muted">جاري تحميل البلديات...</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setDesk(false)} className={`rounded-lg py-2 font-bold ring-1 ${!desk ? "bg-violet-700 text-white ring-violet-700" : "bg-white ring-line"}`}>🏠 للدار</button>
        <button type="button" onClick={() => setDesk(true)} className={`rounded-lg py-2 font-bold ring-1 ${desk ? "bg-violet-700 text-white ring-violet-700" : "bg-white ring-line"}`}>🏢 للمكتب</button>
      </div>
      {desk && !deskOk && <p className="text-xs font-bold text-amber-700">⚠️ هاد البلدية ما فيهاش مكتب عند World Express</p>}
      <div>
        <label className="mb-1 block text-xs font-bold">المبلغ اللي يخلصو الزبون (دج)</label>
        <input className={input} inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value.replace(/\D/g, ""))} />
        <p className="mt-0.5 text-xs text-muted">المجموع تاع الطلبية: {fmt(o.total)}</p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold">ملاحظة للموزع</label>
        <input className={input} value={remarque} onChange={(e) => setRemarque(e.target.value)} placeholder="اختياري" />
      </div>
      {err && <p className="rounded-lg bg-sale/10 p-2 font-semibold text-sale">{err}</p>}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button onClick={send} disabled={busy || !commune || !montant} className="rounded-lg bg-violet-700 py-2.5 font-extrabold text-white disabled:opacity-50">{busy ? "جاري الإرسال..." : "✅ أكّد الإرسال"}</button>
        <button onClick={onCancel} className="rounded-lg bg-white px-4 font-bold ring-1 ring-line">إلغاء</button>
      </div>
    </div>
  );
}
