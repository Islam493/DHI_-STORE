"use client";
import { useEffect, useState } from "react";
import { toast } from "@/components/admin/ui";
import { api } from "@/components/admin/api";
import SaveBar from "@/components/admin/SaveBar";
import CapiCard from "@/components/admin/CapiCard";

type Content = {
  successOrders: number | null; announcement: string[]; socials: { facebook: string; instagram: string; tiktok: string };
  warranty: string; delivery: string[]; returns: string[]; faqs: { q: string; a: string }[];
};
type S = { whatsapp: string; whatsapp2: string; phone: string; phone2: string; pixels: { facebook: string; tiktok: string; snapchat: string }; blocked: { phones: string[]; ips: string[] }; content: Content };

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
    try { await api("/api/admin/settings", { method: "PUT", body: JSON.stringify({ whatsapp: s!.whatsapp, whatsapp2: s!.whatsapp2, phone: s!.phone, phone2: s!.phone2, pixels: s!.pixels, content: s!.content }) }); setMsg({ ok: true, text: "✅ تحفظ! الموقع تحدّث." }); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setSaving(false);
  }
  async function unblock(kind: "phone" | "ip", v: string) {
    try { await api("/api/admin/block", { method: "POST", body: JSON.stringify({ [kind]: v, unblock: true }) }); load(); } catch (e) { toast((e as Error).message, false); }
  }

  const input = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base outline-none focus:border-brand";
  const c = s.content;
  const setC = (patch: Partial<Content>) => setS({ ...s, content: { ...c, ...patch } });
  const area = (k: "announcement" | "delivery" | "returns", rows = 4) => (
    <textarea className={`${input} leading-7`} rows={rows} value={c[k].join("\n")} onChange={(e) => setC({ [k]: e.target.value.split("\n") })} />
  );
  const card = "space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line md:p-5";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-navy">⚙️ الإعدادات</h1>

      <section className={card}>
        <h2 className="font-extrabold text-navy">📞 التواصل</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold">📞 الهاتف الأول<input className={input} dir="ltr" inputMode="tel" value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} placeholder="0563758499" /></label>
          <label className="text-sm font-bold">📞 الهاتف الثاني<input className={input} dir="ltr" inputMode="tel" value={s.phone2} onChange={(e) => setS({ ...s, phone2: e.target.value })} placeholder="0561389326" /></label>
          <label className="text-sm font-bold">💬 واتساب 1<input className={input} dir="ltr" inputMode="tel" value={s.whatsapp} onChange={(e) => setS({ ...s, whatsapp: e.target.value })} placeholder="0563758499" /></label>
          <label className="text-sm font-bold">💬 واتساب 2<input className={input} dir="ltr" inputMode="tel" value={s.whatsapp2} onChange={(e) => setS({ ...s, whatsapp2: e.target.value })} placeholder="0561389326" /></label>
        </div>
      </section>

      <section className={card}>
        <h2 className="font-extrabold text-navy">🏪 محتوى المتجر</h2>
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">⚠️ هاد الكلام يبان للزبائن. اكتب غير الحوايج الصحيحة (الضمان، الإرجاع، الأرقام) باش تبقى الثقة.</p>
        <label className="block text-sm font-bold">عدد الطلبيات الناجحة <span className="font-normal text-muted">(رقمك الحقيقي — فارغ = ما يبانش)</span>
          <input className={input} inputMode="numeric" placeholder="مثلا 3000" value={c.successOrders ?? ""} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setC({ successOrders: v ? Number(v) : null }); }} />
        </label>
        <label className="block text-sm font-bold">الشريط اللي فوق <span className="font-normal text-muted">(كل سطر جملة)</span>{area("announcement", 4)}</label>
        <label className="block text-sm font-bold">الضمان <span className="font-normal text-muted">(فارغ = ما يبانش)</span>
          <input className={input} value={c.warranty} placeholder="مثلا: ضمان 6 أشهر على عيوب المصنع" onChange={(e) => setC({ warranty: e.target.value })} />
        </label>
        <label className="block text-sm font-bold">سياسة التوصيل <span className="font-normal text-muted">(كل سطر نقطة)</span>{area("delivery", 4)}</label>
        <label className="block text-sm font-bold">سياسة الإرجاع والاستبدال {area("returns", 3)}</label>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["facebook", "instagram", "tiktok"] as const).map((k) => (
            <label key={k} className="text-sm font-bold">{k === "facebook" ? "📘 Facebook" : k === "instagram" ? "📸 Instagram" : "🎵 TikTok"}
              <input className={input} dir="ltr" placeholder="https://..." value={c.socials[k]} onChange={(e) => setC({ socials: { ...c.socials, [k]: e.target.value.trim() } })} />
            </label>
          ))}
        </div>
        <div>
          <p className="mb-2 text-sm font-bold">الأسئلة المتكررة (تبان فالرئيسية وفصفحات المنتجات)</p>
          <div className="space-y-2">
            {c.faqs.map((f, i) => (
              <div key={i} className="space-y-1.5 rounded-xl bg-soft p-2.5">
                <div className="flex gap-2">
                  <input className={input} value={f.q} placeholder="السؤال" onChange={(e) => setC({ faqs: c.faqs.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)) })} />
                  <button type="button" onClick={() => setC({ faqs: c.faqs.filter((_, k) => k !== i) })} className="rounded-xl bg-sale/10 px-3 font-bold text-sale">✕</button>
                </div>
                <textarea className={input} rows={2} value={f.a} placeholder="الجواب" onChange={(e) => setC({ faqs: c.faqs.map((x, k) => (k === i ? { ...x, a: e.target.value } : x)) })} />
              </div>
            ))}
            <button type="button" onClick={() => setC({ faqs: [...c.faqs, { q: "", a: "" }] })} className="rounded-xl bg-soft px-4 py-2 text-sm font-bold text-navy ring-1 ring-line">➕ زيد سؤال</button>
          </div>
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
        <CapiCard />
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

      <section className={card}>
        <h2 className="font-extrabold text-navy">💾 النسخة الاحتياطية</h2>
        <p className="text-sm text-muted">نزّل نسخة كاملة (الطلبيات، المنتجات، الإعدادات، الآراء، المخزون، ملاحظات الزبائن) وحفظها عندك. ديرها مرة فالأسبوع.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/backup" download className="rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-white">💾 نزّل النسخة الاحتياطية (JSON)</a>
          <a href="/api/admin/orders/export" download className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-navy ring-1 ring-line">⬇️ كل الطلبيات (Excel)</a>
        </div>
      </section>

      <SaveBar onSave={save} saving={saving} msg={msg} />
    </div>
  );
}
