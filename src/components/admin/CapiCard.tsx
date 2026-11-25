"use client";
import { useEffect, useState } from "react";
import { api, timeAgo } from "./api";
import { toast } from "./ui";

// فيسبوك Conversions API: واش راهو مربوط، شحال تبعث، وزر تجربة
type Stats = { enabled: boolean; pixel: string; test: boolean; orders: number; sent: { purchase: number; confirmed: number; delivered: number }; lastError: string; lastAt: string };

export default function CapiCard() {
  const [s, setS] = useState<Stats | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api<Stats>("/api/admin/capi").then(setS).catch(() => setS(null));
  useEffect(() => { load(); }, []);

  async function test() {
    setBusy(true);
    try {
      const r = await api<{ received: number }>("/api/admin/capi", { method: "POST", body: JSON.stringify({ code }) });
      toast(`✅ فيسبوك استقبل ${r.received} حدث: شوف «Évènements de test»`);
    } catch (e) { toast((e as Error).message, false); }
    setBusy(false);
  }

  if (!s) return null;
  const ok = s.enabled && Boolean(s.pixel);
  return (
    <div className={`rounded-xl p-3 text-sm ring-1 ${ok ? "bg-green-50 ring-green-200" : "bg-amber-50 ring-amber-200"}`}>
      <p className="font-extrabold text-navy">{ok ? "✅" : "⏳"} فيسبوك Conversions API (من السيرفر)</p>
      {ok ? (
        <p className="mt-1 text-xs leading-6 text-green-900">
          فيسبوك يوصلو الطلبيات <b>المؤكدة</b> و<b>المستلمة</b> مع رقم الزبون مشفّر، باش يجيبلك ناس يكمّلو بالصح.
          <br />آخر {s.orders} طلبية: 🛒 {s.sent.purchase} شراء · ✅ {s.sent.confirmed} مؤكدة · 🎉 {s.sent.delivered} مستلمة{s.lastAt && <> · آخر وحدة {timeAgo(s.lastAt)}</>}
        </p>
      ) : (
        <p className="mt-1 text-xs leading-6 text-amber-900">
          {!s.pixel ? "حط رقم Facebook Pixel لفوق. " : ""}
          {!s.enabled && <>زيد <code dir="ltr">META_CAPI_TOKEN</code> فـ Vercel (Settings ← Environment Variables) ومن بعد Redeploy.</>}
        </p>
      )}
      {s.lastError && <p className="mt-1 rounded-lg bg-red-50 p-2 text-xs text-red-800 ring-1 ring-red-200" dir="auto">⚠️ آخر غلطة: {s.lastError}</p>}
      {ok && (
        <div className="mt-2 flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.trim())} dir="ltr" placeholder="TEST12345" className="w-32 rounded-lg border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-brand" aria-label="كود التجربة" />
          <button onClick={test} disabled={busy || !code} className="rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{busy ? "..." : "🧪 بعث حدث تجربة"}</button>
        </div>
      )}
      {ok && <p className="mt-1 text-[11px] text-muted">الكود تاع التجربة تلقاه فـ Events Manager ← CAMPIX ← Évènements de test.</p>}
    </div>
  );
}
