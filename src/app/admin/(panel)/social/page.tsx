"use client";
import { useEffect, useRef, useState } from "react";
import { api, timeAgo } from "@/components/admin/api";
import { Skeleton, toast } from "@/components/admin/ui";

type Social = { enabled: boolean; dm: boolean; comments: boolean; publicReply: boolean; privateReply: boolean; humanHours: number; note: string };
type Thread = { id: string; channel: "facebook" | "instagram"; user_id: string; name: string; last_at: string; last_text: string; paused_until?: string | null; needs_human?: boolean; reason?: string | null; phone?: string | null; product?: string | null };
type Msg = { id?: number; at: string; kind: string; dir: "in" | "out"; body: string; intent?: string | null; handoff?: boolean; source?: string | null; status?: string; error?: string | null };
type Stats = { in: number; dm: number; comments: number; replied: number; failed: number; handoff: number; staff: number } | null;
type Data = {
  social: Social; ready: boolean; model: string; webhookUrl: string;
  keys: { ai: boolean; send: boolean; webhook: boolean; instagram: boolean };
  products: { slug: string; name: string; price: number }[]; stats: Stats; threads: Thread[];
};
type Answer = {
  reply: string; publicReply: string; intent: string; product: string; phone: string; wilaya: string; handoff: boolean; reason: string;
  source: "ai" | "rules"; model?: string; error?: string; usage?: { input: number; output: number; cacheRead: number; cacheWrite: number; usd: number | null };
};
type Turn = { from: "customer" | "bot"; text: string; a?: Answer };

const intents: Record<string, string> = {
  order: "🛒 حاب يطلب", price: "💵 يسقسي على السعر", product_info: "📦 يسقسي على المنتج", delivery: "🚚 التوصيل", after_sale: "🔧 بعد الشراء",
  complaint: "⚠️ شكوى", greeting: "👋 سلام", human: "🙋 يحب يهدر مع الفريق", spam: "🚫 سبام", other: "💬 آخر",
};
const kinds: Record<string, string> = { dm: "رسالة", comment: "كومونتير", private_reply: "رد فالخاص", public_reply: "رد علني", staff: "رد الفريق" };
const examples = ["سلام شحال الكاميرا الشمسية؟", "واش تخدم بلا ويفي؟", "قداش التوصيل لسطيف؟", "نحب نطلب، اسمي محمد 0550123456 من باتنة", "واش راك روبو ولا شخص؟", "طلبيتي ما وصلتش"];
const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => toast("تنسخ ✅")).catch(() => toast("ما تنسخش", false));
const pausedNow = (t: Thread) => Boolean(t.paused_until && new Date(t.paused_until).getTime() > Date.now());

export default function SocialBot() {
  const [d, setD] = useState<Data | null>(null);
  const [s, setS] = useState<Social | null>(null);
  const [busy, setBusy] = useState("");
  const [channel, setChannel] = useState<"facebook" | "instagram">("facebook");
  const [kind, setKind] = useState<"dm" | "comment">("dm");
  const [text, setText] = useState("");
  const [chat, setChat] = useState<Turn[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const end = useRef<HTMLDivElement>(null);

  const load = () => api<Data>("/api/admin/social").then((r) => { setD(r); setS(r.social); }).catch((e) => toast(e.message, false));
  useEffect(() => { load(); }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [chat]);

  async function save(patch?: Partial<Social>) {
    if (!s) return;
    setBusy("save");
    try { const r = await api<{ social: Social }>("/api/admin/social", { method: "PUT", body: JSON.stringify({ ...s, ...patch }) }); setS(r.social); toast("تحفظ ✅"); load(); }
    catch (e) { toast((e as Error).message, false); }
    setBusy("");
  }
  async function test(msg = text) {
    const t = msg.trim();
    if (!t || busy === "test") return;
    const history = kind === "dm" ? chat.map(({ from, text }) => ({ from, text })) : [];
    setChat((c) => [...(kind === "dm" ? c : []), { from: "customer", text: t }]);
    setText("");
    setBusy("test");
    try {
      const a = await api<Answer>("/api/admin/social", { method: "POST", body: JSON.stringify({ action: "test", text: t, channel, kind, history }) });
      setChat((c) => [...c, { from: "bot", text: a.reply, a }]);
    } catch (e) { toast((e as Error).message, false); }
    setBusy("");
  }
  async function openThread(id: string) {
    if (open === id) { setOpen(null); return; }
    setOpen(id); setMsgs([]);
    try { setMsgs((await api<{ messages: Msg[] }>(`/api/admin/social?thread=${encodeURIComponent(id)}`)).messages); } catch (e) { toast((e as Error).message, false); }
  }
  async function threadAct(id: string, action: "pause" | "resume" | "done") {
    try { await api("/api/admin/social", { method: "POST", body: JSON.stringify({ action, thread: id }) }); toast("تم ✅"); load(); }
    catch (e) { toast((e as Error).message, false); }
  }

  if (!d || !s) return <Skeleton rows={6} className="h-24" />;
  const k = d.keys;
  const live = s.enabled && k.send && k.webhook;
  const box = "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line md:p-5";
  const input = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand";
  const Card = ({ ok, title, yes, no, opt }: { ok: boolean; title: string; yes: string; no: string; opt?: boolean }) => (
    <div className={`rounded-2xl p-4 ring-1 ${ok ? "bg-green-50 ring-green-200" : opt ? "bg-soft ring-line" : "bg-amber-50 ring-amber-200"}`}>
      <p className="text-sm font-extrabold text-navy">{ok ? "✅" : opt ? "➖" : "⏳"} {title}</p>
      <p className={`mt-1 text-xs ${ok ? "text-green-800" : opt ? "text-muted" : "text-amber-900"}`}>{ok ? yes : no}</p>
    </div>
  );
  const Toggle = ({ k: key, title, sub }: { k: keyof Social; title: string; sub: string }) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 hover:bg-soft">
      <input type="checkbox" className="mt-1 size-5 accent-brand" checked={Boolean(s[key])} onChange={(e) => setS({ ...s, [key]: e.target.checked })} />
      <span><b className="block text-sm text-navy">{title}</b><span className="text-xs text-muted">{sub}</span></span>
    </label>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-navy">💬 روبوت الرسائل (فيسبوك وانستغرام)</h1>
        <p className="mt-1 text-sm text-muted">يجاوب الزبائن فالخاص وعلى الكومونتيرات بالدارجة، يعطي السعر ورابط الطلب، وكي يلزم يخليها للفريق ويبعثلك تنبيه. يعرف غير المنتجات والأسعار اللي فالمتجر (ما يخترعش).</p>
      </div>

      {!d.ready && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <b>⚙️ خطوة SQL:</b> نفّذ ملف <code dir="ltr">supabase/social.sql</code> فـ Supabase (SQL Editor ← New query ← الصق ← Run). بلا هاد الخطوة الروبوت ما يجاوبش (باش ما يعاودش الرد زوج مرات).
        </div>
      )}

      <div className={`rounded-2xl p-4 text-sm font-bold ring-1 ${live ? "bg-green-50 text-green-900 ring-green-200" : "bg-soft text-navy ring-line"}`}>
        {live ? "🟢 الروبوت شاعل ويجاوب الزبائن دركا." : s.enabled ? "🟡 الزر شاعل، بصح الروبوت مازال ما يقدرش يبعث: ناقصين مفاتيح Meta (شوف تحت)." : "⚪ الروبوت مطفي: ما يجاوب حتى واحد. جرّبو تحت، وكي يعجبك شعّلو."}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card ok={k.ai} title="الذكاء الاصطناعي (Claude)" yes={`يكتب الردود (${d.model})`} no="ANTHROPIC_API_KEY ناقص: يجاوب بردود جاهزة برك (السعر + الرابط)" />
        <Card ok={k.send} title="صفحة فيسبوك" yes="يقدر يبعث الردود" no="زيد META_PAGE_TOKEN و META_PAGE_ID فـ Vercel" />
        <Card ok={k.webhook} title="الرسائل الداخلة (Webhook)" yes="الرسائل والكومونتيرات يوصلو" no="زيد META_APP_SECRET و META_VERIFY_TOKEN" />
        <Card ok={k.instagram} opt title="انستغرام" yes="الحساب مربوط بالصفحة" no="اختياري: META_IG_ID (باش ما يجاوبش على روحو)" />
      </div>

      <section className={box}>
        <h2 className="mb-2 font-extrabold text-navy">⚙️ الإعدادات</h2>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-soft p-3 ring-1 ring-line">
          <input type="checkbox" className="size-6 accent-brand" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />
          <span><b className="block text-navy">🤖 الروبوت يجاوب الزبائن</b><span className="text-xs text-muted">الزر الكبير. مطفي = ما يخرج حتى رد (الرسائل تتسجل برك).</span></span>
        </label>
        <div className="mt-2 grid gap-1 md:grid-cols-2">
          <Toggle k="dm" title="📩 الرسائل فالخاص" sub="Messenger و Instagram Direct" />
          <Toggle k="comments" title="💬 الكومونتيرات" sub="تحت المنشورات والإعلانات" />
          <Toggle k="privateReply" title="📨 يبعث فالخاص لصاحب الكومونتير" sub="السعر + الرابط فالخاص (مرة وحدة لكل كومونتير)" />
          <Toggle k="publicReply" title="🗨️ رد علني قصير تحت الكومونتير" sub="مثال: «مرحبا بيك 🙏 بعثنالك التفاصيل فالخاص 📩»" />
        </div>
        <label className="mt-3 block text-xs font-bold">⏸️ كي واحد من الفريق يجاوب بيدّو (ولا الروبوت يخليها للفريق)، الروبوت يسكت فهاد المحادثة (ساعات)
          <input type="number" min={1} max={168} className={`${input} mt-1 max-w-32`} value={s.humanHours} onChange={(e) => setS({ ...s, humanHours: Number(e.target.value) })} />
        </label>
        <label className="mt-3 block text-xs font-bold">📝 تعليمات زايدة للروبوت (اختياري)
          <textarea rows={3} className={`${input} mt-1`} value={s.note} maxLength={1500} onChange={(e) => setS({ ...s, note: e.target.value })}
            placeholder="مثال: هاد السمانة التوصيل مجاني على الكاميرا الشمسية. ما تعطيش السعر علني فالكومونتيرات." />
          <span className="font-normal text-muted">الروبوت يتبعها، بصح ما يخترعش أسعار ولا وعود ماهيش فالمتجر.</span>
        </label>
        <button onClick={() => save()} disabled={busy === "save"} className="mt-4 rounded-xl bg-brand px-6 py-2.5 font-bold text-white disabled:opacity-60">{busy === "save" ? "..." : "💾 حفظ"}</button>
      </section>

      <section className={box}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-extrabold text-navy">🧪 جرّب الروبوت (ما يخرج والو للزبائن)</h2>
          <button onClick={() => setChat([])} className="text-xs font-bold text-muted">🗑️ مسح</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
          {(["facebook", "instagram"] as const).map((c) => <button key={c} onClick={() => setChannel(c)} className={`rounded-full px-3 py-1.5 ring-1 ${channel === c ? "bg-navy text-white ring-navy" : "bg-white ring-line"}`}>{c === "facebook" ? "فيسبوك" : "انستغرام"}</button>)}
          <span className="mx-1 text-line">|</span>
          {(["dm", "comment"] as const).map((x) => <button key={x} onClick={() => { setKind(x); setChat([]); }} className={`rounded-full px-3 py-1.5 ring-1 ${kind === x ? "bg-brand text-white ring-brand" : "bg-white ring-line"}`}>{x === "dm" ? "📩 رسالة فالخاص" : "💬 كومونتير"}</button>)}
        </div>
        <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto rounded-xl bg-soft p-3 ring-1 ring-line">
          {chat.length === 0 && <p className="py-6 text-center text-sm text-muted">اكتب كيما يكتب الزبون، ولا اختار مثال تحت 👇</p>}
          {chat.map((t, i) => t.from === "customer" ? (
            <div key={i} className="mr-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-navy shadow-sm ring-1 ring-line"><span className="text-[11px] text-muted">{kind === "comment" ? "💬 كومونتير" : "👤 الزبون"}</span><p className="whitespace-pre-line">{t.text}</p></div>
          ) : (
            <div key={i} className="ml-auto max-w-[85%] space-y-1">
              {t.a?.publicReply && <div className="rounded-2xl bg-sky-50 px-3 py-2 text-sm ring-1 ring-sky-200"><span className="text-[11px] text-sky-800">🗨️ الرد العلني تحت الكومونتير</span><p className="whitespace-pre-line text-navy">{t.a.publicReply}</p></div>}
              <div className="rounded-2xl rounded-tr-sm bg-brand px-3 py-2 text-sm text-white shadow-sm">
                <span className="text-[11px] text-white/80">{kind === "comment" ? "📨 فالخاص" : "🤖 الروبوت"}</span>
                <p className="whitespace-pre-line break-words" dir="auto">{t.text || "(ما يجاوبش على هادي)"}</p>
              </div>
              {t.a && (
                <p className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-line">{intents[t.a.intent] || t.a.intent}</span>
                  {t.a.handoff && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-900">🙋 للفريق: {t.a.reason}</span>}
                  {t.a.phone && <span className="rounded-full bg-green-100 px-2 py-0.5 font-bold text-green-900" dir="ltr">📞 {t.a.phone}</span>}
                  <span className="rounded-full bg-white px-2 py-0.5 text-muted ring-1 ring-line">{t.a.source === "ai" ? "🧠 ذكاء اصطناعي" : "📋 رد جاهز"}</span>
                  {t.a.usage?.usd != null && <span className="rounded-full bg-white px-2 py-0.5 text-muted ring-1 ring-line" dir="ltr">${t.a.usage.usd.toFixed(4)}</span>}
                </p>
              )}
              {t.a?.error && <p className="text-[11px] font-semibold text-sale">⚠️ {t.a.error}</p>}
            </div>
          ))}
          {busy === "test" && <p className="ml-auto w-fit rounded-2xl bg-white px-3 py-2 text-sm text-muted ring-1 ring-line">يكتب…</p>}
          <div ref={end} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); test(); }} className="mt-2 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === "comment" ? "اكتب كومونتير…" : "اكتب رسالة الزبون…"} className={input} dir="auto" />
          <button disabled={busy === "test" || !text.trim()} className="shrink-0 rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">إرسال</button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {examples.map((x) => <button key={x} onClick={() => test(x)} disabled={busy === "test"} className="rounded-full bg-white px-2.5 py-1 text-xs ring-1 ring-line hover:bg-soft">{x}</button>)}
        </div>
        <p className="mt-2 text-xs text-muted">يعرف {d.products.length} منتجات من المتجر. الهواتف والكاميرات السرية ما يهدرش عليهم (سياسات فيسبوك): يخليهم للفريق.</p>
      </section>

      {d.stats && (
        <section className={box}>
          <h2 className="mb-3 font-extrabold text-navy">📊 آخر 7 أيام</h2>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4 lg:grid-cols-7">
            {([["📥 دخلو", d.stats.in], ["📩 رسائل", d.stats.dm], ["💬 كومونتيرات", d.stats.comments], ["🤖 جاوب", d.stats.replied], ["🙋 للفريق", d.stats.handoff], ["👤 الفريق جاوب", d.stats.staff], ["⚠️ ما خرجش", d.stats.failed]] as const).map(([l, n]) => (
              <div key={l} className="rounded-xl bg-soft p-3 ring-1 ring-line"><p className="text-xl font-extrabold text-navy">{n}</p><p className="text-[11px] text-muted">{l}</p></div>
            ))}
          </div>
        </section>
      )}

      <section className={box}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-extrabold text-navy">🗂️ المحادثات</h2>
          <a href="https://business.facebook.com/latest/inbox" target="_blank" rel="noopener" className="text-xs font-bold text-brand">جاوب من Meta Business Suite ↗</a>
        </div>
        {d.threads.length === 0 ? <p className="p-4 text-center text-sm text-muted">مازال ما وصلت حتى رسالة</p> : (
          <ul className="mt-2 divide-y divide-line">
            {d.threads.map((t) => (
              <li key={t.id} className="py-2.5">
                <button onClick={() => openThread(t.id)} className="flex w-full items-start gap-3 text-right">
                  <span className="shrink-0 text-lg">{t.channel === "instagram" ? "📸" : "📘"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <b className="text-sm text-navy">{t.name || "زبون"}</b>
                      {t.needs_human && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-900">🙋 يستناك{t.reason ? `: ${t.reason}` : ""}</span>}
                      {pausedNow(t) && <span className="rounded-full bg-soft px-2 py-0.5 font-bold ring-1 ring-line">⏸️ الروبوت ساكت</span>}
                      {t.phone && <span className="font-bold text-green-800" dir="ltr">📞 {t.phone}</span>}
                      <span>{timeAgo(t.last_at)}</span>
                    </span>
                    <span className="line-clamp-1 text-sm text-navy">{t.last_text}</span>
                  </span>
                </button>
                {open === t.id && (
                  <div className="mt-2 space-y-2 rounded-xl bg-soft p-3 ring-1 ring-line">
                    {msgs.length === 0 && <p className="text-center text-xs text-muted">…</p>}
                    {msgs.map((m, i) => (
                      <div key={m.id ?? i} className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${m.dir === "in" ? "mr-auto bg-white ring-1 ring-line" : m.source === "staff" ? "ml-auto bg-navy text-white" : "ml-auto bg-brand text-white"}`}>
                        <p className={`text-[11px] ${m.dir === "in" ? "text-muted" : "text-white/80"}`}>{kinds[m.kind] || m.kind} · {timeAgo(m.at)}{m.status === "failed" ? " · ⚠️ ما خرجش" : ""}</p>
                        <p className="whitespace-pre-line break-words" dir="auto">{m.body}</p>
                        {m.error && <p className="text-[11px] font-semibold text-amber-200">⚠️ {m.error}</p>}
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {pausedNow(t)
                        ? <button onClick={() => threadAct(t.id, "resume")} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white">▶️ رجّع الروبوت</button>
                        : <button onClick={() => threadAct(t.id, "pause")} className="rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-white">⏸️ نجاوب أنا (وقّف الروبوت هنا)</button>}
                      {t.needs_human && <button onClick={() => threadAct(t.id, "done")} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-navy ring-1 ring-line">✅ تم، جاوبتو</button>}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${box} space-y-3`}>
        <h2 className="font-extrabold text-navy">🔗 الربط مع Meta</h2>
        <div>
          <p className="text-xs font-bold">Callback URL (حطو فـ Meta for Developers ← Webhooks)</p>
          <button onClick={() => copy(d.webhookUrl)} className="mt-1 w-full break-all rounded-xl bg-soft p-3 text-left font-mono text-xs ring-1 ring-line" dir="ltr">{d.webhookUrl} 📋</button>
          <p className="mt-1 text-xs text-muted">Verify token = نفس القيمة اللي حطيتها فـ <code dir="ltr">META_VERIFY_TOKEN</code>.</p>
        </div>
        <ol className="list-decimal space-y-1.5 pr-5 text-sm text-navy">
          <li>ادخل <b dir="ltr">developers.facebook.com</b> ← My Apps ← <b>Create App</b> (نوع Business) واربطو بالبيزنس اللي فيه الصفحة.</li>
          <li>زيد المنتجات: <b dir="ltr">Messenger</b> و <b dir="ltr">Instagram</b> و <b dir="ltr">Webhooks</b>.</li>
          <li>فـ Messenger ← اربط الصفحة «DHI electronics» ← <b>Generate token</b> ← هاداك هو <code dir="ltr">META_PAGE_TOKEN</code>.</li>
          <li>Webhooks ← Page: اشترك فـ <b dir="ltr">messages</b>, <b dir="ltr">message_echoes</b>, <b dir="ltr">feed</b>. و Instagram: <b dir="ltr">messages</b>, <b dir="ltr">comments</b>.</li>
          <li>App settings ← Basic ← <b dir="ltr">App secret</b> ← هاداك هو <code dir="ltr">META_APP_SECRET</code>.</li>
          <li>فـ Vercel ← Settings ← Environment Variables زيد: <code dir="ltr">META_PAGE_TOKEN</code>، <code dir="ltr">META_PAGE_ID</code>، <code dir="ltr">META_APP_SECRET</code>، <code dir="ltr">META_VERIFY_TOKEN</code> (كلمة من عندك)، <code dir="ltr">META_IG_ID</code>، و <code dir="ltr">ANTHROPIC_API_KEY</code> ← Redeploy.</li>
          <li>باش يخدم مع كل الزبائن (ماشي غير معاك): <b dir="ltr">App Review</b> للصلاحيات <span dir="ltr">pages_messaging, pages_manage_engagement, pages_read_user_content, instagram_manage_messages, instagram_manage_comments</span>، و <b>Business verification</b>.</li>
        </ol>
        <p className="text-xs text-muted">⚠️ المفاتيح يتحطو غير فـ Vercel، عمرك ما تبعثهم فالشات ولا لحتى واحد.</p>
      </section>
    </div>
  );
}
