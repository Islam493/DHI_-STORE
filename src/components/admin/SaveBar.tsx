"use client";
export default function SaveBar({ onSave, saving, msg }: { onSave: () => void; saving: boolean; msg: { ok: boolean; text: string } | null }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-white/95 p-3 backdrop-blur md:-mx-6">
      {msg && <p className={`mb-2 rounded-xl p-2 text-sm font-semibold ${msg.ok ? "bg-ok/10 text-ok" : "bg-sale/10 text-sale"}`}>{msg.text}</p>}
      <button onClick={onSave} disabled={saving} className="w-full rounded-xl bg-brand py-3.5 text-lg font-extrabold text-white disabled:opacity-50">{saving ? "جاري الحفظ..." : "💾 حفظ"}</button>
    </div>
  );
}
