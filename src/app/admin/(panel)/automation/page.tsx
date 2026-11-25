"use client";
import { useEffect, useState } from "react";
import { api, timeAgo } from "@/components/admin/api";
import { Skeleton, toast } from "@/components/admin/ui";

type Auto = { confirm: boolean; reminderHours: number; noAnswerHours: number; autoShip: boolean; tracking: boolean; messages: boolean };
type Msg = { id: number; at: string; order_id: string | null; phone: string; dir: "in" | "out"; kind: string; body: string; status: string; error?: string | null };
type Data = {
  ready: boolean; wa: { enabled: boolean; webhook: boolean; verify: boolean }; carrier: boolean; cron: boolean; telegram: boolean;
  webhookUrl: string; cronUrl: string; footer: string; automation: Auto; templates: { name: string; text: string; buttons: string[]; vars: number }[]; messages: Msg[];
};

const kinds: Record<string, string> = {
  dhi_confirm: "طلب التأكيد", dhi_confirm_reminder: "تذكير", dhi_shipped: "خرجت", dhi_out_for_delivery: "الليفرور جاي", dhi_missed: "ما لقاهش",
  dhi_delivered: "وصلت", auto_reply: "رد أوتوماتيك", staff: "رد الفريق", button: "ضغط زر", text: "رسالة",
};
const statusIcon: Record<string, string> = { sent: "✓", delivered: "✓✓", read: "👁️", failed: "⚠️", received: "📥" };
const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => toast("تنسخ ✅")).catch(() => toast("ما تنسخش", false));

export default function Automation() {
  const [d, setD] = useState<Data | null>(null);
  const [a, setA] = useState<Auto | null>(null);
  const [busy, setBusy] = useState("");
  const [phone, setPhone] = useState("");
  const [tracking, setTracking] = useState("");
  const [track, setTrack] = useState<{ label: string; state: string; raw: unknown } | null>(null);
  const [tickRes, setTickRes] = useState<Record<string, unknown> | null>(null);

  const load = () => api<Data>("/api/admin/automation").then((r) => { setD(r); setA(r.automation); }).catch((e) => toast(e.message, false));
  useEffect(() => { load(); }, []);

  async function save() {
    setBusy("save");
    try { await api("/api/admin/automation", { method: "PUT", body: JSON.stringify(a) }); toast("تحفظ ✅"); load(); }
    catch (e) { toast((e as Error).message, false); }
    setBusy("");
  }
  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    try {
      const r = await api<Record<string, unknown>>("/api/admin/automation", { method: "POST", body: JSON.stringify({ action, ...extra }) });
      if (action === "test") toast("خرجت ✅ شوف الواتساب تاعك");
      if (action === "telegram") toast("خرجت ✅ شوف تيليغرام");
      if (action === "track") setTrack(r as never);
      if (action === "tick") { setTickRes(r.result as Record<string, unknown>); load(); }
    } catch (e) { toast((e as Error).message, false); }
    setBusy("");
  }

  if (!d || !a) return <Skeleton rows={6} className="h-24" />;
  const Card = ({ ok, title, yes, no }: { ok: boolean; title: string; yes: string; no: string }) => (
    <div className={`rounded-2xl p-4 ring-1 ${ok ? "bg-green-50 ring-green-200" : "bg-amber-50 ring-amber-200"}`}>
      <p className="text-sm font-extrabold text-navy">{ok ? "✅" : "⏳"} {title}</p>
      <p className={`mt-1 text-xs ${ok ? "text-green-800" : "text-amber-900"}`}>{ok ? yes : no}</p>
    </div>
  );
  const Toggle = ({ k, title, sub }: { k: keyof Auto; title: string; sub: string }) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 hover:bg-soft">
      <input type="checkbox" className="mt-1 size-5 accent-brand" checked={Boolean(a[k])} onChange={(e) => setA({ ...a, [k]: e.target.checked })} />
      <span><b className="block text-sm text-navy">{title}</b><span className="text-xs text-muted">{sub}</span></span>
    </label>
  );
  const box = "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line md:p-5";
  const input = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-navy">🤖 الأتمتة (واتساب)</h1>
        <p className="mt-1 text-sm text-muted">الطلبية تتأكد وتتبّع وحدها حتى توصل للزبون: رسالة تأكيد بالأزرار ← تذكير ← خرجت ← الليفرور جاي ← وصلت.</p>
      </div>

      {!d.ready && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <b>⚙️ خطوة SQL:</b> نفّذ ملف <code dir="ltr">supabase/whatsapp.sql</code> فـ Supabase (SQL Editor ← New query ← الصق ← Run) باش تتحفظ الرسائل.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card ok={d.wa.enabled} title="واتساب" yes="مربوط ويبعث الرسائل" no="زيد WHATSAPP_TOKEN و WHATSAPP_PHONE_ID فـ Vercel" />
        <Card ok={d.wa.webhook} title="ردود الزبائن" yes="الأزرار والردود يوصلو" no="زيد WHATSAPP_APP_SECRET و WHATSAPP_VERIFY_TOKEN" />
        <Card ok={d.carrier} title="World Express" yes="التتبع والإرسال يخدمو" no="ECOTRACK_TOKEN ناقص" />
        <Card ok={d.cron} title="الدورة الأوتوماتيكية" yes="CRON_SECRET كاين" no="زيد CRON_SECRET فـ Vercel" />
        <Card ok={d.telegram} title="تنبيهات تيليغرام" yes="الفريق يوصلو التنبيهات" no="اختياري: TELEGRAM_BOT_TOKEN" />
      </div>

      <section className={box}>
        <h2 className="mb-2 font-extrabold text-navy">⚙️ الإعدادات</h2>
        <div className="grid gap-1 md:grid-cols-2">
          <Toggle k="confirm" title="✅ تأكيد بالواتساب" sub="كي تجي طلبية، الزبون تجيه رسالة فيها «نأكد» و«نلغي». كي يضغط، الحالة تتبدّل وحدها." />
          <Toggle k="autoShip" title="🚚 يبعثها لـ World Express وحدها" sub="كي الزبون يأكد، الطلبية تتسجل عند World Express ويوصلو رقم التتبع. (خليها مطفية إذا تحب تراجع قبل)" />
          <Toggle k="tracking" title="📍 تتبع الطرد" sub="كل شوية نشوفو الحالة عند World Express. كي توصل: «مكتملة» وحدها." />
          <Toggle k="messages" title="💬 رسائل التتبع للزبون" sub="«خرجت» + «الليفرور جاي» + «ما لقاكش» + «وصلت». تنقّص الروتور." />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold">⏰ التذكير إذا ما جاوبش بعد (ساعات)
            <input type="number" min={1} max={48} className={input} value={a.reminderHours} onChange={(e) => setA({ ...a, reminderHours: Number(e.target.value) })} />
          </label>
          <label className="text-xs font-bold">📵 «لم يرد» (يعيطلو الفريق) بعد (ساعات)
            <input type="number" min={2} max={120} className={input} value={a.noAnswerHours} onChange={(e) => setA({ ...a, noAnswerHours: Number(e.target.value) })} />
          </label>
        </div>
        <button onClick={save} disabled={busy === "save"} className="mt-4 rounded-xl bg-brand px-6 py-2.5 font-bold text-white disabled:opacity-60">{busy === "save" ? "..." : "💾 حفظ"}</button>
      </section>

      <section className={box}>
        <h2 className="font-extrabold text-navy">📝 القوالب (سجّلهم فـ WhatsApp Manager)</h2>
        <p className="mt-1 text-xs text-muted">WhatsApp Manager ← Message templates ← Create template ← الفئة <b>Utility</b> ← اللغة <b>Arabic</b>. الاسم لازم يكون نفسو بالضبط، والأزرار <b>Quick reply</b> بنفس الترتيب، والـ <b>Footer</b> تحت كل رسالة.</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {d.templates.map((t) => (
            <div key={t.name} className="rounded-xl bg-soft p-3 ring-1 ring-line">
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => copy(t.name)} className="rounded-lg bg-white px-2 py-1 font-mono text-xs font-bold text-navy ring-1 ring-line" dir="ltr">{t.name} 📋</button>
                <span className="text-[11px] text-muted">{kinds[t.name]} · {t.vars} متغيرات</span>
              </div>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-navy">{t.text}</pre>
              <p className="mt-1 text-[11px] text-muted">Footer: {d.footer}</p>
              {t.buttons.length > 0 && <p className="mt-2 flex flex-wrap gap-1.5">{t.buttons.map((b) => <span key={b} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-brand ring-1 ring-line">{b}</span>)}</p>}
              <button onClick={() => copy(t.text)} className="mt-2 text-xs font-bold text-brand">📋 نسخ النص</button>
            </div>
          ))}
        </div>
      </section>

      <section className={`${box} space-y-3`}>
        <h2 className="font-extrabold text-navy">🔗 الربط</h2>
        <div>
          <p className="text-xs font-bold">Webhook URL (حطو فـ Meta ← WhatsApp ← Configuration)</p>
          <button onClick={() => copy(d.webhookUrl)} className="mt-1 w-full break-all rounded-xl bg-soft p-3 text-left font-mono text-xs ring-1 ring-line" dir="ltr">{d.webhookUrl} 📋</button>
          <p className="mt-1 text-xs text-muted">Verify token = نفس القيمة اللي حطيتها فـ <code dir="ltr">WHATSAPP_VERIFY_TOKEN</code>. واشترك فـ <b dir="ltr">messages</b>.</p>
        </div>
        <div>
          <p className="text-xs font-bold">الدورة كل 15 دقيقة (مجاناً فـ cron-job.org)</p>
          <p className="mt-1 break-all rounded-xl bg-soft p-3 font-mono text-xs ring-1 ring-line" dir="ltr">{d.cronUrl}<b>CRON_SECRET</b></p>
          <p className="mt-1 text-xs text-muted">بدّل CRON_SECRET بالقيمة اللي حطيتها فـ Vercel. (Vercel يخدمها مرة فالنهار، واللوحة كي تكون محلولة كل 10 دقايق.)</p>
        </div>
      </section>

      <section className={`${box} space-y-4`}>
        <h2 className="font-extrabold text-navy">🧪 التجربة</h2>
        <div className="flex flex-wrap gap-2">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقمك (06…)" dir="ltr" className={`${input} max-w-56`} />
          <button onClick={() => act("test", { phone })} disabled={busy === "test"} className="rounded-xl bg-wa px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">📲 ابعثلي رسالة تجربة</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="رقم تتبع World Express" dir="ltr" className={`${input} max-w-56`} />
          <button onClick={() => act("track", { tracking })} disabled={busy === "track" || !tracking} className="rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">🔍 اقرا الحالة</button>
          <button onClick={() => act("telegram")} disabled={busy === "telegram"} className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">✈️ جرّب تيليغرام</button>
          <button onClick={() => act("tick")} disabled={busy === "tick"} className="rounded-xl bg-soft px-4 py-2.5 text-sm font-bold text-navy ring-1 ring-line disabled:opacity-60">{busy === "tick" ? "..." : "▶️ شغّل الدورة دركا"}</button>
        </div>
        {track && (
          <div className="rounded-xl bg-soft p-3 text-sm ring-1 ring-line">
            <p>الحالة: <b>{track.label || "—"}</b> ← <b className="text-brand">{track.state}</b></p>
            <details className="mt-1"><summary className="cursor-pointer text-xs text-muted">الجواب الكامل</summary><pre className="mt-1 max-h-60 overflow-auto text-[11px]" dir="ltr">{JSON.stringify(track.raw, null, 2)}</pre></details>
          </div>
        )}
        {tickRes && <pre className="rounded-xl bg-soft p-3 text-xs ring-1 ring-line" dir="ltr">{JSON.stringify(tickRes, null, 2)}</pre>}
      </section>

      <section className={box}>
        <h2 className="mb-2 font-extrabold text-navy">💬 آخر الرسائل</h2>
        {d.messages.length === 0 ? <p className="p-4 text-center text-sm text-muted">مازال ما خرجت حتى رسالة</p> : (
          <ul className="divide-y divide-line">
            {d.messages.map((m) => (
              <li key={m.id} className="flex gap-3 py-2.5 text-sm">
                <span className="shrink-0 text-lg">{m.dir === "in" ? "📥" : "📤"}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <b className="text-navy">{kinds[m.kind] || m.kind}</b>
                    <span dir="ltr">{m.phone}</span>
                    {m.order_id && <a href={`/admin/orders/${m.order_id}`} className="font-bold text-brand" dir="ltr">#{m.order_id}</a>}
                    <span>{timeAgo(m.at)}</span>
                    <span title={m.status}>{statusIcon[m.status] || m.status}</span>
                  </p>
                  <p className="line-clamp-2 whitespace-pre-line text-navy">{m.body}</p>
                  {m.error && <p className="text-xs font-semibold text-sale">⚠️ {m.error}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
