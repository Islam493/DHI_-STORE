"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/admin/api";
import SaveBar from "@/components/admin/SaveBar";

type S = { whatsapp: string; phone: string; pixels: { facebook: string; tiktok: string; snapchat: string }; blocked: { phones: string[]; ips: string[] } };

const pixelHelp = [
  { k: "facebook", label: "Facebook Pixel", icon: "📘", ph: "1234567890123456", url: "https://business.facebook.com/events_manager" },
  { k: "tiktok", label: "TikTok Pixel", icon: "🎵", ph: "CABC12DEF34GH", url: "https://ads.tiktok.com/i18n/events_manager" },
  { k: "snapchat", label: "Snapchat Pixel", icon: "👻", ph: "a1b2c3d4-xxxx-xxxx", url: "https://ads.snapchat.com" },
] as const;

export default function Settings() {
  const [s, setS] = useState<S | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const load = () => api<S>("/api/admin/settings").then(setS).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); }, []);
  if (!s) return <p className="p-8 text-center text-muted">{msg?.text || "جاري التحميل..."}</p>;

  async function save() {
    setSaving(true); setMsg(null);
    try { await api("/api/admin/settings", { method: "PUT", body: JSON.stringify({ whatsapp: s!.whatsapp, phone: s!.phone, pixels: s!.pixels }) }); setMsg({ ok: true, text: "✅ تحفظ! الموقع تحدّث." }); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setSaving(false);
  }
  async function unblock(kind: "phone" | "ip", v: string) {
    try { await api("/api/admin/block", { method: "POST", body: JSON.stringify({ [kind]: v, unblock: true }) }); load(); } catch (e) { alert((e as Error).message); }
  }

  const input = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base outline-none focus:border-brand";
  const card = "space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line md:p-5";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-navy">⚙️ الإعدادات</h1>

      <section className={card}>
        <h2 className="font-extrabold text-navy">📞 التواصل</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold">رقم الواتساب<input className={input} dir="ltr" inputMode="tel" value={s.whatsapp} onChange={(e) => setS({ ...s, whatsapp: e.target.value })} placeholder="0555123456" /></label>
          <label className="text-sm font-bold">رقم الهاتف (يبان للزبائن)<input className={input} dir="ltr" inputMode="tel" value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} placeholder="0555 12 34 56" /></label>
        </div>
      </section>

      <section className={card}>
        <h2 className="font-extrabold text-navy">🎯 البيكسلات</h2>
        <p className="text-xs text-muted">حط رقم كل بيكسل. الموقع يبعث وحدو: زيارة، شاف منتج، بدا الطلب، وكمّل الطلب (مع السعر).</p>
        {pixelHelp.map((p) => (
          <div key={p.k}>
            <div className="mb-1 flex items-center justify-between text-sm font-bold">
              <span>{p.icon} {p.label} {s.pixels[p.k] && <span className="mr-1 rounded-full bg-ok/10 px-2 py-0.5 text-xs text-ok">● مفعّل</span>}</span>
              <a href={p.url} target="_blank" rel="noopener" className="text-xs font-bold text-brand">وين نلقاه؟ ↗</a>
            </div>
            <input className={input} dir="ltr" value={s.pixels[p.k]} placeholder={p.ph} onChange={(e) => setS({ ...s, pixels: { ...s.pixels, [p.k]: e.target.value.trim() } })} />
          </div>
        ))}
      </section>

      <section className={card}>
        <h2 className="font-extrabold text-navy">🚫 المحظورين</h2>
        <p className="text-xs text-muted">المحظور يقدر يعمّر الفورم، بصح الطلبية ما توصلكش. تحظر من صفحة الطلبية.</p>
        {s.blocked.phones.length + s.blocked.ips.length === 0 ? <p className="rounded-xl bg-soft p-4 text-center text-sm text-muted">ما كانش محظورين</p> : (
          <ul className="divide-y divide-line rounded-xl ring-1 ring-line">
            {[...s.blocked.phones.map((v) => ["phone", v] as const), ...s.blocked.ips.map((v) => ["ip", v] as const)].map(([k, v]) => (
              <li key={k + v} className="flex items-center justify-between p-3 text-sm">
                <span dir="ltr" className="font-bold">{k === "phone" ? "📱" : "🌐"} {v}</span>
                <button onClick={() => unblock(k, v)} className="rounded-lg bg-soft px-3 py-1.5 text-xs font-bold">🔓 فك الحظر</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SaveBar onSave={save} saving={saving} msg={msg} />
    </div>
  );
}
