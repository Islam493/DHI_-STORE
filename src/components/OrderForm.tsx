"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Wilaya } from "@/lib/wilayas";
import { formatPrice } from "@/lib/config";
import { track } from "@/lib/track";
import type { Product } from "@/lib/catalog";

type Errors = Record<string, string>;

export default function OrderForm({ product, wilayas }: { product: Product; wilayas: Wilaya[] }) {
  const router = useRouter();
  const [variant, setVariant] = useState(product.variants[0]?.name ?? "");
  const [qty, setQty] = useState(1);
  const [wilaya, setWilaya] = useState<number | "">("");
  const [method, setMethod] = useState<"home" | "desk">("home");
  const [errors, setErrors] = useState<Errors>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const unit = product.variants.find((v) => v.name === variant)?.price ?? product.price;
  const w = wilayas.find((x) => x.code === wilaya);
  const fee = w ? (method === "desk" ? w.desk : w.home) : null;
  const total = unit * qty + (fee ?? 0);

  const onStart = () => {
    if (started.current) return;
    started.current = true;
    track("InitiateCheckout", { id: product.id, name: product.name, value: unit });
  };

  const field = useMemo(
    () => "w-full rounded-xl border border-line bg-white px-4 py-3 text-base outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15",
    []
  );

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
          product: product.slug, variant, quantity: qty, wilaya, method,
          name: fd.get("name"), phone: fd.get("phone"), commune: fd.get("commune"),
          address: fd.get("address"), note: fd.get("note"), website: fd.get("website"),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        try {
          sessionStorage.setItem("lastOrder", JSON.stringify({ id: data.id, total: data.total, pid: product.id, name: product.name, qty }));
        } catch {}
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

  return (
    <form id="order" onSubmit={submit} onFocus={onStart}
      onInput={(e) => { const n = (e.target as HTMLInputElement).name; if (n && errors[n]) setErrors((prev) => { const next = { ...prev }; delete next[n]; return next; }); }} noValidate className="scroll-mt-28 rounded-3xl border-2 border-brand/30 bg-gradient-to-b from-brand/5 to-white p-4 md:p-6">
      <h2 className="mb-1 text-xl font-extrabold text-navy">🛒 اطلب الآن — الدفع عند الاستلام</h2>
      <p className="mb-5 text-sm text-muted">عمّر المعلومات وفريقنا يتصل بيك باش يأكد الطلبية.</p>

      {product.variants.length > 0 && (
        <div className="mb-4">
          <label className="mb-2 block text-sm font-bold">النوع / اللون</label>
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

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <input name="name" autoComplete="name" placeholder="الاسم واللقب *" className={field} required />
          {err("name")}
        </div>
        <div>
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="رقم الهاتف * (05 / 06 / 07)" dir="rtl" className={field} required />
          {err("phone")}
        </div>
        <div>
          <select value={wilaya} onChange={(e) => {
            const code = e.target.value ? Number(e.target.value) : "";
            setWilaya(code);
            if (wilayas.find((x) => x.code === code)?.desk == null) setMethod("home");
          }} className={field} required>
            <option value="">اختار الولاية *</option>
            {wilayas.map((x) => <option key={x.code} value={x.code}>{String(x.code).padStart(2, "0")} - {x.name}</option>)}
          </select>
          {err("wilaya")}
        </div>
        <div>
          <input name="commune" placeholder="البلدية *" className={field} required />
          {err("commune")}
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-bold">طريقة التوصيل</label>
        <div className="grid grid-cols-2 gap-2">
          {([["home", "🏠 للدار", w?.home], ["desk", "🏢 للمكتب", w?.desk]] as const).map(([k, label, price]) => {
            const disabled = !!w && price == null;
            return (
              <button type="button" key={k} disabled={disabled} onClick={() => setMethod(k)}
                className={`rounded-xl border-2 px-3 py-3 text-right text-sm font-bold transition disabled:opacity-40 ${method === k ? "border-brand bg-brand/10 text-navy" : "border-line bg-white"}`}>
                <span className="block">{label}</span>
                <span className="text-xs font-semibold text-muted">{w ? (price == null ? "غير متوفر" : formatPrice(price)) : "اختار الولاية"}</span>
              </button>
            );
          })}
        </div>
        {err("method")}
      </div>

      {method === "home" && (
        <div className="mt-3">
          <input name="address" autoComplete="street-address" placeholder="العنوان (الحي، الشارع...) *" className={field} />
          {err("address")}
        </div>
      )}
      <textarea name="note" rows={2} placeholder="ملاحظة (اختياري)" className={`${field} mt-3`} />
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-white p-3 ring-1 ring-line">
        <span className="text-sm font-bold">الكمية</span>
        <div className="flex items-center gap-3" dir="ltr">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="size-9 rounded-lg bg-soft text-lg font-bold">−</button>
          <span className="w-6 text-center text-lg font-extrabold">{qty}</span>
          <button type="button" onClick={() => setQty((q) => Math.min(10, q + 1))} className="size-9 rounded-lg bg-soft text-lg font-bold">+</button>
        </div>
      </div>

      <dl className="mt-4 space-y-2 rounded-2xl bg-soft p-4 text-sm">
        <div className="flex justify-between"><dt>سعر المنتج</dt><dd className="font-bold">{formatPrice(unit * qty)}</dd></div>
        <div className="flex justify-between"><dt>التوصيل</dt><dd className="font-bold">{fee === null ? "—" : formatPrice(fee)}</dd></div>
        <div className="flex justify-between border-t border-line pt-2 text-base"><dt className="font-extrabold">المجموع</dt><dd className="font-extrabold text-brand">{formatPrice(total)}</dd></div>
      </dl>

      {msg && <p className="mt-3 rounded-xl bg-sale/10 p-3 text-sm font-semibold text-sale">{msg}</p>}

      <button disabled={busy} className="cta-pulse mt-4 w-full rounded-2xl bg-brand py-4 text-lg font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-60">
        {busy ? "جاري الإرسال..." : `أكّد الطلبية — ${formatPrice(total)}`}
      </button>
      <p className="mt-3 text-center text-xs text-muted">🔒 معلوماتك محمية — ما تخلص حتى توصلك السلعة</p>
    </form>
  );
}
