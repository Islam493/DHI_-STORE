"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Wilaya } from "@/lib/wilayas";
import { formatPrice } from "@/lib/config";
import { track } from "@/lib/track";
import type { Offer, Product } from "@/lib/catalog";

type Errors = Record<string, string>;
type Commune = { name: string; desk: boolean };

const pieces = (n: number) => (n === 1 ? "قطعة وحدة" : n === 2 ? "زوج قطع" : `${n} قطع`);

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
  const fee = w ? (method === "desk" ? (hasDesk ? w.desk : null) : w.home) : null;
  const total = subtotal + (fee ?? 0);
  const shown = list ? (method === "desk" ? deskList! : list) : null;

  // البلديات تاع الولاية من World Express
  useEffect(() => {
    setCommune(""); setList(null);
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

  const onStart = () => {
    if (started.current) return;
    started.current = true;
    track("InitiateCheckout", { id: product.id, name: product.name, value: unit });
  };
  const clearErr = (k: string) => errors[k] && setErrors((prev) => { const next = { ...prev }; delete next[k]; return next; });

  const field = "w-full rounded-xl border border-line bg-white px-4 py-3 text-base outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:bg-soft disabled:text-muted";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true); setErrors({}); setMsg("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: product.slug, variant, quantity: qty, wilaya, method, commune,
          name: fd.get("name"), phone: fd.get("phone"), website: fd.get("website"),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        try { sessionStorage.setItem("lastOrder", JSON.stringify({ id: data.id, total: data.total, pid: product.id, name: product.name, qty })); } catch {}
        router.push(`/thank-you?id=${data.id}`);
        return;
      }
      if (data.errors) setErrors(data.errors);
      setMsg(data.error || "تأكّد من المعلومات اللي باللون الأحمر");
    } catch {
      setMsg("ما قدرناش نبعثو الطلبية، تأكّد من الإنترنت وعاود");
    }
    setBusy(false);
  }

  const err = (k: string) => errors[k] && <p className="mt-1 text-sm font-semibold text-sale">{errors[k]}</p>;
  const step = (n: number, t: string) => (
    <p className="mb-2 flex items-center gap-2 text-sm font-extrabold text-navy"><span className="grid size-6 place-items-center rounded-full bg-brand text-xs text-white">{n}</span>{t}</p>
  );
  let n = 0;

  return (
    <form id="order" onSubmit={submit} onFocus={onStart}
      onInput={(e) => { const k = (e.target as HTMLInputElement).name; if (k) clearErr(k); }} noValidate
      className="scroll-mt-28 overflow-hidden rounded-3xl border border-brand/25 bg-white shadow-xl shadow-brand/10">
      <div className="bg-gradient-to-l from-navy to-[#173a6b] px-4 py-4 text-white md:px-6">
        <h2 className="text-xl font-extrabold">🛒 اطلب الآن</h2>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-white/80"><span>💵 الدفع عند الاستلام</span><span>🚚 توصيل لـ 58 ولاية</span><span>📞 نتصلو بيك نأكدو</span></p>
      </div>

      <div className="space-y-5 p-4 md:p-6">
        {offers.length > 0 && (
          <fieldset>
            {step(++n, "🎁 اختار العرض")}
            <div className="grid gap-2">
              {offers.map((o) => {
                const save = product.price * o.qty - o.price;
                const on = o.qty === qty;
                return (
                  <button type="button" key={o.qty} onClick={() => setQty(o.qty)} aria-pressed={on}
                    className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-right transition ${on ? "border-brand bg-brand/5 shadow-md shadow-brand/10" : "border-line bg-white hover:border-brand/40"}`}>
                    <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-brand" : "border-line"}`}>{on && <span className="size-2.5 rounded-full bg-brand" />}</span>
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
          <div>
            {step(++n, "النوع / اللون")}
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button type="button" key={v.name} onClick={() => setVariant(v.name)}
                  className={`rounded-xl border-2 px-4 py-2 text-sm font-bold ${variant === v.name ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>
                  {v.name}
                </button>
              ))}
            </div>
            {err("variant")}
          </div>
        )}

        <div>
          {step(++n, "👤 معلوماتك")}
          <div className="grid gap-3 md:grid-cols-2">
            <div><input name="name" autoComplete="name" placeholder="الاسم واللقب *" className={field} required />{err("name")}</div>
            <div><input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="رقم الهاتف * (05 / 06 / 07)" dir="rtl" className={field} required />{err("phone")}</div>
          </div>
        </div>

        <div>
          {step(++n, "📍 وين نوصلوهالك؟")}
          <select value={wilaya} onChange={(e) => { setWilaya(e.target.value ? Number(e.target.value) : ""); clearErr("wilaya"); }} className={field} required>
            <option value="">اختار الولاية *</option>
            {wilayas.map((x) => <option key={x.code} value={x.code}>{String(x.code).padStart(2, "0")} - {x.name}</option>)}
          </select>
          {err("wilaya")}

          <div className="mt-3 grid grid-cols-2 gap-2">
            {([["home", "🏠 للدار", w?.home ?? null, true], ["desk", "🏢 للمكتب", w?.desk ?? null, hasDesk]] as const).map(([k, label, price, ok]) => (
              <button type="button" key={k} disabled={!!w && !ok} onClick={() => { setMethod(k); clearErr("method"); }} aria-pressed={method === k}
                className={`rounded-2xl border-2 px-3 py-3 text-right transition disabled:cursor-not-allowed disabled:opacity-45 ${method === k ? "border-brand bg-brand/5" : "border-line bg-white"}`}>
                <span className="block font-extrabold text-navy">{label}</span>
                <span className="text-sm font-bold text-brand">{!w ? <span className="text-xs font-semibold text-muted">اختار الولاية</span> : !ok || price == null ? <span className="text-xs font-semibold text-muted">ما كانش مكتب</span> : formatPrice(price)}</span>
              </button>
            ))}
          </div>
          {err("method")}

          <div className="mt-3">
            {shown ? (
              <select value={commune} onChange={(e) => { setCommune(e.target.value); clearErr("commune"); }} className={field} required>
                <option value="">{method === "desk" ? `اختار المكتب (${shown.length}) *` : "اختار البلدية *"}</option>
                {shown.map((c) => <option key={c.name} value={c.name}>{c.name}{method === "home" && c.desk ? " 🏢" : ""}</option>)}
              </select>
            ) : (
              <input value={commune} onChange={(e) => { setCommune(e.target.value); clearErr("commune"); }} disabled={!w || loading}
                placeholder={!w ? "البلدية * (اختار الولاية قبل)" : loading ? "…نجيبو البلديات" : method === "desk" ? "البلدية تاع المكتب *" : "البلدية *"} className={field} required />
            )}
            {method === "desk" && shown && <p className="mt-1 text-xs text-muted">🏢 تستلم الطلبية من مكتب World Express فالبلدية اللي تختارها</p>}
            {err("commune")}
          </div>
        </div>

        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

        {offers.length === 0 && (
          <div className="flex items-center justify-between rounded-2xl bg-soft p-3">
            <span className="text-sm font-extrabold text-navy">الكمية</span>
            <div className="flex items-center gap-3" dir="ltr">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="size-9 rounded-lg bg-white text-lg font-bold ring-1 ring-line">−</button>
              <span className="w-6 text-center text-lg font-extrabold">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(10, q + 1))} className="size-9 rounded-lg bg-white text-lg font-bold ring-1 ring-line">+</button>
            </div>
          </div>
        )}

        <dl className="space-y-2 rounded-2xl bg-soft p-4 text-sm">
          <div className="flex justify-between"><dt>{offer && offers.length ? pieces(qty) : "سعر المنتج"}</dt><dd className="font-bold">{formatPrice(subtotal)}</dd></div>
          <div className="flex justify-between"><dt>التوصيل {w && <span className="text-muted">({method === "desk" ? "للمكتب" : "للدار"})</span>}</dt><dd className="font-bold">{fee === null ? "—" : formatPrice(fee)}</dd></div>
          <div className="flex justify-between border-t border-line pt-2 text-base"><dt className="font-extrabold">المجموع</dt><dd className="font-extrabold text-brand">{formatPrice(total)}</dd></div>
        </dl>

        {msg && <p className="rounded-xl bg-sale/10 p-3 text-sm font-semibold text-sale">{msg}</p>}

        <button disabled={busy} className="cta-pulse w-full rounded-2xl bg-brand py-4 text-lg font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-60">
          {busy ? "جاري الإرسال..." : `أكّد الطلبية — ${formatPrice(total)}`}
        </button>
        <p className="text-center text-xs text-muted">🔒 معلوماتك محمية — ما تخلص حتى توصلك السلعة</p>
      </div>
    </form>
  );
}
