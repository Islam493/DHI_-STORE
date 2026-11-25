"use client";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Wilaya } from "@/lib/wilayas";
import { formatPrice } from "@/lib/config";
import { fbIds, track } from "@/lib/track";
import type { Offer, Product } from "@/lib/catalog";

type Errors = Record<string, string>;
type Commune = { name: string; desk: boolean };

// الأرقام العربية (٠١٢…) ← 012، والرقم يتنظف (فراغات، +213…)
const latin = (s: string) => s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
function cleanPhone(v: string) {
  let d = latin(v).replace(/\D/g, "");
  if (d.startsWith("00213")) d = d.slice(5); else if (d.startsWith("213") && d.length === 12) d = d.slice(3);
  if (/^[567]\d{8}$/.test(d)) d = "0" + d;
  return d;
}
const SAVED = "dhi-customer"; // الزبون اللي طلب قبل: نعمّرولو معلوماتو
// وين نروحو كي تكون غلطة (الخانة)
const FIELD: Record<string, string> = { name: 'input[name="name"]', phone: 'input[name="phone"]', wilaya: 'select[aria-label="الولاية"]', commune: '[aria-label="البلدية"]', method: '[data-field="method"]', variant: '[data-field="variant"]' };

const pieces = (n: number) => (n === 1 ? "قطعة وحدة" : n === 2 ? "زوج قطع" : `${n} قطع`);

// أيقونات صغار (بلا مكتبات)
const Ico = ({ d, className = "size-5" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
const I = {
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z",
  pin: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  home: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  desk: "M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M14 9h1M14 13h1",
  lock: "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
  check: "M20 6L9 17l-5-5",
  chev: "M6 9l6 6 6-6",
};

export default function OrderForm({ product, wilayas }: { product: Product; wilayas: Wilaya[] }) {
  const router = useRouter();
  const [variant, setVariant] = useState(product.variants[0]?.name ?? "");
  const [qty, setQty] = useState(1);
  const [wilaya, setWilaya] = useState<number | "">("");
  const [method, setMethod] = useState<"home" | "desk">("home");
  const [list, setList] = useState<Commune[] | null>(null); // null = ما جاتش القائمة (نكتبو البلدية)
  const [loading, setLoading] = useState(false);
  const [commune, setCommune] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const free = !!product.freeShipping;
  const formRef = useRef<HTMLFormElement>(null);

  // العروض: إذا صاحب المتجر حط عروض، الزبون يختار واحد (قطعة وحدة ديما كاينة)
  const offers: Offer[] = useMemo(() => {
    const o = product.variants.length ? [] : product.offers || [];
    if (!o.length) return [];
    return o.some((x) => x.qty === 1) ? o : [{ qty: 1, price: product.price }, ...o];
  }, [product]);

  const unit = product.variants.find((v) => v.name === variant)?.price ?? product.price;
  const offer = offers.find((o) => o.qty === qty);
  const subtotal = offer ? offer.price : unit * qty;
  const w = wilayas.find((x) => x.code === wilaya);
  const deskList = list?.filter((c) => c.desk) ?? null;
  const hasDesk = !w ? true : w.desk != null && (deskList ? deskList.length > 0 : true);
  const normalFee = w ? (method === "desk" ? (hasDesk ? w.desk : null) : w.home) : null;
  const fee = normalFee === null ? null : free ? 0 : normalFee;
  const total = subtotal + (fee ?? 0);
  const shown = list ? (method === "desk" ? deskList! : list) : null;

  // الزبون اللي طلب قبل من هاد التيليفون: نعمّرولو الاسم، الرقم، الولاية والبلدية
  const savedCommune = useRef("");
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem(SAVED) || "null");
      const f = formRef.current;
      if (!c || !f) return;
      const set = (n: string, v: string) => { const el = f.elements.namedItem(n) as HTMLInputElement | null; if (el && !el.value && v) el.value = v; };
      set("name", c.name || ""); set("phone", c.phone || "");
      if (c.wilaya && wilayas.some((w) => w.code === c.wilaya)) { savedCommune.current = c.commune || ""; setWilaya(c.wilaya); }
      if (c.method === "desk" || c.method === "home") setMethod(c.method);
    } catch { /* ما كانش */ }
  }, [wilayas]);

  // البلديات تاع الولاية من World Express
  useEffect(() => {
    // البلدية المحفوظة (زبون رجع) نحطوها غير كي تكون الولاية مختارة
    setCommune(wilaya ? savedCommune.current : ""); if (wilaya) savedCommune.current = ""; setList(null);
    if (!wilaya) return;
    let alive = true;
    setLoading(true);
    fetch(`/api/communes?w=${wilaya}`).then((r) => r.json()).then((d) => {
      if (alive) setList(Array.isArray(d.communes) && d.communes.length ? d.communes : null);
    }).catch(() => alive && setList(null)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [wilaya]);

  useEffect(() => { if (method === "desk" && !hasDesk) setMethod("home"); }, [method, hasDesk]);
  useEffect(() => { if (shown && commune && !shown.some((c) => c.name === commune)) setCommune(""); }, [shown, commune]);

  // الطلبات المتروكة: كي يكتب الزبون رقم صحيح نحفظو المسودة (حتى إذا خرج بلا ما يأكد)
  const draft = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sent = useRef("");
  const done = useRef(false);
  const live = useRef({ variant, qty, wilaya, method, commune });
  live.current = { variant, qty, wilaya, method, commune };
  const draftKey = `dhi-draft:${product.slug}`;
  useEffect(() => {
    try { draft.current = sessionStorage.getItem(draftKey) || ""; } catch {}
    if (!draft.current) {
      draft.current = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
      try { sessionStorage.setItem(draftKey, draft.current); } catch {}
    }
  }, [draftKey]);
  const flush = useCallback((beacon = false) => {
    clearTimeout(timer.current);
    const f = formRef.current;
    if (done.current || !f || !draft.current) return;
    const val = (k: string) => String((f.elements.namedItem(k) as HTMLInputElement | null)?.value || "");
    const phone = val("phone").replace(/[\s.-]/g, "").replace(/^(\+213|00213)/, "0");
    if (!/^0[567]\d{8}$/.test(phone)) return;
    const { variant: v, qty: q, wilaya: wl, method: m, commune: c } = live.current;
    const body = JSON.stringify({ draft: draft.current, product: product.slug, variant: v, quantity: q, wilaya: wl, method: m, commune: c, name: val("name"), phone, hp: val("dhi_hp_x") });
    if (body === sent.current) return;
    sent.current = body;
    if (beacon && navigator.sendBeacon) navigator.sendBeacon("/api/abandoned", new Blob([body], { type: "application/json" }));
    else fetch("/api/abandoned", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => { sent.current = ""; });
  }, [product.slug]);
  const later = useCallback(() => { clearTimeout(timer.current); timer.current = setTimeout(() => flush(), 2500); }, [flush]);
  useEffect(() => { later(); }, [variant, qty, wilaya, method, commune, later]);
  useEffect(() => {
    const hide = () => { if (document.visibilityState === "hidden") flush(true); };
    const leave = () => flush(true);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    return () => { document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", leave); flush(true); };
  }, [flush]);

  const onStart = () => {
    if (started.current) return;
    started.current = true;
    router.prefetch("/thank-you"); // صفحة الشكر تكون واجدة قبل ما يضغط
    track("InitiateCheckout", { id: product.id, name: product.name, value: unit });
  };
  const clearErr = (k: string) => errors[k] && setErrors((prev) => { const next = { ...prev }; delete next[k]; return next; });

  // نوديو الزبون للخانة اللي فيها الغلطة (ماشي لفوق الفورميلار)
  function showErrors(errs: Errors, text: string) {
    setErrors(errs); setMsg(text);
    const first = ["variant", "name", "phone", "wilaya", "method", "commune"].find((k) => errs[k]);
    const el = first ? formRef.current?.querySelector<HTMLElement>(FIELD[first]) : null;
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => el.focus?.({ preventScroll: true }), 350); }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    const phone = cleanPhone(String(fd.get("phone") || ""));
    const name = String(fd.get("name") || "").trim();
    // نتأكدو قبل ما نبعثو (دغيا، بلا انترنت)
    const errs: Errors = {};
    if (product.variants.length && !variant) errs.variant = "اختار النوع";
    if (name.length < 2) errs.name = "اكتب اسمك";
    if (!/^0[567]\d{8}$/.test(phone)) errs.phone = "رقم الهاتف: 10 أرقام يبدا بـ 05 ولا 06 ولا 07";
    if (!wilaya) errs.wilaya = "اختار الولاية";
    else if (!commune.trim()) errs.commune = method === "desk" ? "اختار المكتب" : "اختار البلدية";
    if (Object.keys(errs).length) return showErrors(errs, "باقي حاجة صغيرة ⬆️ كمّلها وعاود اضغط");
    setBusy(true); setErrors({}); setMsg("");
    clearTimeout(timer.current);
    done.current = true;
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: product.slug, variant, quantity: qty, wilaya, method, commune,
          name, phone, hp: fd.get("dhi_hp_x"), draft: draft.current, ...fbIds(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        try { sessionStorage.setItem("lastOrder", JSON.stringify({ id: data.id, total: data.total, pid: product.id, name: product.name, qty })); sessionStorage.removeItem(draftKey); } catch {}
        try { localStorage.setItem(SAVED, JSON.stringify({ name, phone, wilaya, commune, method })); } catch {}
        // البيكسل يتشارجا من جديد فصفحة الشكر ومعاه رقم الزبون (مشفّر) ← «الشراء» يتربط بالإعلان مليح
        const to = `/thank-you?id=${data.id}`;
        if ((window as { __px?: { fb?: boolean } }).__px?.fb) window.location.assign(to); else router.push(to);
        return;
      }
      if (data.errors) showErrors(data.errors, "تأكّد من المعلومات اللي باللون الأحمر ⬆️");
      else setMsg(data.error || "صرا مشكل، عاود اضغط ولا اتصل بينا");
    } catch {
      setMsg("ما قدرناش نبعثو الطلبية، تأكّد من الإنترنت وعاود");
    }
    done.current = false;
    setBusy(false);
  }

  const bad = (k: string) => !!errors[k];
  const err = (k: string) => errors[k] && <p className="mt-1.5 flex items-center gap-1 text-sm font-semibold text-sale">⚠️ {errors[k]}</p>;
  const box = (k: string) => `group relative flex items-center rounded-2xl border-2 bg-white transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 ${bad(k) ? "border-sale/60 bg-sale/5" : "border-line"}`;
  const input = "peer w-full min-w-0 appearance-none bg-transparent py-3.5 pl-4 pr-12 text-base font-semibold text-navy outline-none placeholder:font-normal placeholder:text-muted/80 disabled:cursor-not-allowed disabled:text-muted";
  const icon = (d: string) => <span className="pointer-events-none absolute right-4 text-muted transition group-focus-within:text-brand"><Ico d={d} /></span>;
  const chev = <span className="pointer-events-none absolute left-4 text-muted"><Ico d={I.chev} className="size-4" /></span>;
  const label = (t: string, n: number) => (
    <p className="mb-2 flex items-center gap-2 text-[15px] font-extrabold text-navy"><span className="grid size-6 place-items-center rounded-full bg-navy text-[11px] text-white">{n}</span>{t}</p>
  );
  let n = 0;

  return (
    <form id="order" ref={formRef} onSubmit={submit} onFocus={onStart}
      onInput={(e) => {
        const el = e.target as HTMLInputElement; const k = el.name;
        if (k === "phone" && /[\u0660-\u0669\u06F0-\u06F9]/.test(el.value)) el.value = latin(el.value);
        if (k) clearErr(k); if (k === "name" || k === "phone") later();
      }} noValidate
      className="scroll-mt-28 overflow-hidden rounded-[1.75rem] bg-white shadow-[0_20px_50px_-12px_rgba(11,31,58,.25)] ring-1 ring-line">

      {/* الراس: المنتج والسعر */}
      <div className="relative overflow-hidden bg-gradient-to-l from-navy via-[#12305a] to-[#1b4a8a] p-4 text-white md:p-5">
        <div className="pointer-events-none absolute -left-10 -top-16 size-48 rounded-full bg-brand/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-white ring-2 ring-white/30">
            <Image src={product.images[0]} alt="" fill sizes="64px" className="object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white/70">🛒 اطلب الآن — تخلص كي توصلك</p>
            <p className="line-clamp-1 font-extrabold">{product.name}</p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-2"><b className="text-lg">{formatPrice(unit)}</b>
              {product.compareAtPrice && product.compareAtPrice > unit && <span className="text-xs text-white/60 line-through">{formatPrice(product.compareAtPrice)}</span>}
              {free && <span className="rounded-full bg-ok px-2 py-0.5 text-[11px] font-extrabold">🚚 توصيل مجاني</span>}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-4 md:p-6">
        {offers.length > 0 && (
          <fieldset>
            {label("🎁 اختار العرض", ++n)}
            <div className="grid gap-2">
              {offers.map((o) => {
                const save = product.price * o.qty - o.price;
                const on = o.qty === qty;
                return (
                  <button type="button" key={o.qty} onClick={() => setQty(o.qty)} aria-pressed={on}
                    className={`relative flex items-center gap-3 rounded-2xl border-2 p-3.5 text-right transition ${on ? "border-brand bg-brand/5 shadow-md shadow-brand/10" : "border-line bg-white hover:border-brand/40"}`}>
                    {o.qty > 1 && save > 0 && o.qty === Math.max(...offers.map((x) => x.qty)) && <span className="absolute -top-2.5 left-3 rounded-full bg-sale px-2 py-0.5 text-[10px] font-extrabold text-white">الأكثر توفير</span>}
                    <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-brand bg-brand text-white" : "border-line"}`}>{on && <Ico d={I.check} className="size-3" />}</span>
                    <span className="flex-1">
                      <b className="block font-extrabold text-navy">{pieces(o.qty)}</b>
                      {o.qty > 1 && <span className="text-xs font-semibold text-muted">{formatPrice(Math.round(o.price / o.qty))} للقطعة</span>}
                    </span>
                    {save > 0 && <span className="rounded-full bg-ok/10 px-2.5 py-1 text-xs font-extrabold text-ok">وفّر {formatPrice(save)}</span>}
                    <b className="text-lg font-extrabold text-brand">{formatPrice(o.price)}</b>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {product.variants.length > 0 && (
          <div data-field="variant" tabIndex={-1} className="outline-none">
            {label("النوع / اللون", ++n)}
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button type="button" key={v.name} onClick={() => setVariant(v.name)} aria-pressed={variant === v.name}
                  className={`flex items-center gap-1.5 rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition ${variant === v.name ? "border-brand bg-brand text-white shadow-md shadow-brand/20" : "border-line bg-white hover:border-brand/40"}`}>
                  {variant === v.name && <Ico d={I.check} className="size-4" />}{v.name}
                </button>
              ))}
            </div>
            {err("variant")}
          </div>
        )}

        <div>
          {label("معلوماتك", ++n)}
          <div className="grid gap-3 md:grid-cols-2">
            <div><div className={box("name")}>{icon(I.user)}<input name="name" autoComplete="name" placeholder="الاسم واللقب" aria-label="الاسم واللقب" className={input} required /></div>{err("name")}</div>
            <div><div className={box("phone")}>{icon(I.phone)}<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="رقم الهاتف (05 / 06 / 07)" aria-label="رقم الهاتف" className={input} required /></div>{err("phone")}</div>
          </div>
          <p className="mt-2 text-xs text-muted">🔒 نستعملو رقمك باش نتصلو بيك على هاد الطلبية ونبعثولك التأكيد والتتبع على الواتساب 💬، ويخرج مشفّر لفيسبوك باش نقيسو الإعلانات</p>
        </div>

        <div>
          {label("وين نوصلوهالك؟", ++n)}
          <div className={box("wilaya")}>{icon(I.pin)}
            <select value={wilaya} onChange={(e) => { setWilaya(e.target.value ? Number(e.target.value) : ""); clearErr("wilaya"); }} className={`${input} cursor-pointer ${wilaya === "" ? "font-normal text-muted" : ""}`} aria-label="الولاية" required>
              <option value="">اختار الولاية</option>
              {wilayas.map((x) => <option key={x.code} value={x.code}>{String(x.code).padStart(2, "0")} - {x.name}</option>)}
            </select>{chev}
          </div>
          {err("wilaya")}

          <div data-field="method" tabIndex={-1} className="mt-3 grid grid-cols-2 gap-2 outline-none">
            {([["home", "للدار", I.home, w?.home ?? null, true], ["desk", "للمكتب", I.desk, w?.desk ?? null, hasDesk]] as const).map(([k, t, ic, price, ok]) => {
              const on = method === k, off = !!w && (!ok || price == null);
              return (
                <button type="button" key={k} disabled={off} onClick={() => { setMethod(k); clearErr("method"); }} aria-pressed={on}
                  className={`flex items-center gap-2.5 rounded-2xl border-2 p-3 text-right transition disabled:cursor-not-allowed disabled:opacity-45 ${on ? "border-brand bg-brand/5" : "border-line bg-white hover:border-brand/40"}`}>
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${on ? "bg-brand text-white" : "bg-soft text-navy"}`}><Ico d={ic} /></span>
                  <span className="min-w-0">
                    <b className="block font-extrabold text-navy">{t}</b>
                    <span className="text-xs font-bold">{!w ? <span className="font-semibold text-muted">اختار الولاية</span>
                      : off ? <span className="font-semibold text-muted">ما كانش مكتب</span>
                      : free ? <span className="text-ok">مجاني <s className="font-semibold text-muted">{formatPrice(price!)}</s></span>
                      : <span className="text-brand">{formatPrice(price!)}</span>}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {err("method")}

          <div className="mt-3">
            <div className={box("commune")}>{icon(method === "desk" ? I.desk : I.pin)}
              {shown ? (
                <>
                  <select value={commune} onChange={(e) => { setCommune(e.target.value); clearErr("commune"); }} className={`${input} cursor-pointer ${commune === "" ? "font-normal text-muted" : ""}`} aria-label="البلدية" required>
                    <option value="">{method === "desk" ? `اختار المكتب (${shown.length})` : "اختار البلدية"}</option>
                    {shown.map((c) => <option key={c.name} value={c.name}>{c.name}{method === "home" && c.desk ? " 🏢" : ""}</option>)}
                  </select>{chev}
                </>
              ) : (
                <input value={commune} onChange={(e) => { setCommune(e.target.value); clearErr("commune"); }} disabled={!w || loading} aria-label="البلدية"
                  placeholder={!w ? "البلدية (اختار الولاية قبل)" : loading ? "…نجيبو البلديات" : method === "desk" ? "البلدية تاع المكتب" : "البلدية"} className={input} required />
              )}
            </div>
            {method === "desk" && shown && <p className="mt-1.5 text-xs text-muted">🏢 تستلم طلبيتك من مكتب World Express فالبلدية اللي تختارها</p>}
            {err("commune")}
          </div>
        </div>

        <input name="dhi_hp_x" tabIndex={-1} autoComplete="new-password" className="hidden" aria-hidden />

        {offers.length === 0 && (
          <div className="flex items-center justify-between rounded-2xl border-2 border-line p-3">
            <span className="font-extrabold text-navy">الكمية</span>
            <div className="flex items-center gap-3" dir="ltr">
              <button type="button" aria-label="نقّص" onClick={() => setQty((q) => Math.max(1, q - 1))} className="size-10 rounded-xl bg-soft text-xl font-bold text-navy transition hover:bg-brand hover:text-white">−</button>
              <span className="w-6 text-center text-lg font-extrabold">{qty}</span>
              <button type="button" aria-label="زيد" onClick={() => setQty((q) => Math.min(10, q + 1))} className="size-10 rounded-xl bg-soft text-xl font-bold text-navy transition hover:bg-brand hover:text-white">+</button>
            </div>
          </div>
        )}

        {/* الحساب */}
        <div className="rounded-2xl bg-gradient-to-b from-soft to-white p-4 ring-1 ring-line">
          <p className="mb-3 text-sm font-extrabold text-navy">🧾 ملخص الطلبية</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">{offer && offers.length ? pieces(qty) : `المنتج × ${qty}`}</dt><dd className="font-bold">{formatPrice(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">التوصيل {w && `(${method === "desk" ? "للمكتب" : "للدار"})`}</dt>
              <dd className="font-bold">{fee === null ? (free ? <span className="text-ok">مجاني 🎁</span> : "—") : fee === 0 ? <span className="text-ok">مجاني 🎁 {normalFee ? <s className="text-xs font-semibold text-muted">{formatPrice(normalFee)}</s> : null}</span> : formatPrice(fee)}</dd></div>
            <div className="flex items-baseline justify-between border-t border-dashed border-line pt-3"><dt className="font-extrabold text-navy">المجموع</dt><dd className="text-2xl font-extrabold text-brand">{formatPrice(total)}</dd></div>
          </dl>
        </div>

        {msg && <p className="rounded-xl bg-sale/10 p-3 text-sm font-semibold text-sale">{msg}</p>}

        <button type="submit" disabled={busy} className="cta-pulse group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-l from-brand to-[#1d5fd0] py-4 text-lg font-extrabold text-white shadow-lg shadow-brand/30 transition hover:brightness-110 disabled:opacity-60">
          {busy ? "جاري الإرسال..." : <>أكّد الطلبية — {formatPrice(total)} <span aria-hidden className="transition group-hover:-translate-x-1">←</span></>}
        </button>

        <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-bold text-navy">
          <span className="rounded-xl bg-soft px-1 py-2">💵<br />الدفع عند الاستلام</span>
          <span className="rounded-xl bg-soft px-1 py-2">{free ? "🎁" : "🚚"}<br />{free ? "توصيل مجاني" : "58 ولاية"}</span>
          <span className="rounded-xl bg-soft px-1 py-2">📞<br />نتصلو بيك نأكدو</span>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted"><Ico d={I.lock} className="size-3.5" /> معلوماتك محمية — ما تخلص حتى توصلك السلعة</p>
      </div>
    </form>
  );
}
