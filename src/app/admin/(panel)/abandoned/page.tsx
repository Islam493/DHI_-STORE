"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, fmt, timeAgo } from "@/components/admin/api";
import { Empty, Skeleton, confirmAction, toast, useCan } from "@/components/admin/ui";
import { cartStatuses, riskColor, riskOf, type Cart, type CartStatus, type PhoneHistory } from "@/lib/abandoned-types";

type Row = Cart & { image: string | null };
type P = { id: string; slug: string; name: string; variants: string[]; offers: number[] };
type W = { code: number; name: string; home: number; desk: number | null };
type Res = { ready: boolean; rows: Row[]; total: number; typing: number; page: number; per: number; counts: Record<CartStatus, number>; history: Record<string, PhoneHistory>; products: P[]; wilayas: W[] };
type Commune = { name: string; desk: boolean };

const tabs: (CartStatus | "all")[] = ["open", "contacted", "converted", "ignored", "all"];
const intl = (p: string) => p.replace(/^0/, "213");

function waText(c: Cart) {
  const hi = c.name ? `السلام عليكم ${c.name} 👋` : "السلام عليكم 👋";
  return [
    hi,
    `معاك DHI Electronics. شفنا بلي كنت حاب تطلب «${c.product_name}»${c.total ? ` (${fmt(c.total)})` : ""} وما كمّلتش الطلبية.`,
    `حاب نكمّلوهالك؟ التوصيل${c.wilaya_name ? ` لـ ${c.wilaya_name}` : " لـ 58 ولاية"} والدفع عند الاستلام 💵`,
    "جاوبنا هنا ولا عيّطلنا ونسجلوهالك دركا 🙏",
  ].join("\n");
}

function Abandoned() {
  const router = useRouter();
  const sp = useSearchParams();
  const can = useCan();
  const status = (sp.get("status") || "open") as CartStatus | "all";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const [d, setD] = useState<Res | null>(null);
  const [err, setErr] = useState("");
  const [conv, setConv] = useState<Row | null>(null);
  const key = sp.toString();

  const load = useCallback(async () => {
    setErr("");
    try { setD(await api<Res>(`/api/admin/abandoned?${key}`)); } catch (e) { setErr((e as Error).message); }
  }, [key]);
  useEffect(() => { setD(null); load(); }, [load]);

  const go = (patch: Record<string, string>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k); }
    if (!("page" in patch)) n.delete("page");
    router.push(`/admin/abandoned?${n}`);
  };

  async function setStatus(ids: string[], s: CartStatus, quiet = false) {
    try {
      await api("/api/admin/abandoned", { method: "PATCH", body: JSON.stringify({ ids, status: s }) });
      if (!quiet) toast(`«${cartStatuses[s].label}»`);
      load();
    } catch (e) { toast((e as Error).message, false); }
  }
  async function remove(id: string) {
    if (!(await confirmAction("تحذف هاد الطلبية المتروكة نهائياً؟"))) return;
    try { await api("/api/admin/abandoned", { method: "DELETE", body: JSON.stringify({ ids: [id] }) }); toast("تحذفت"); load(); }
    catch (e) { toast((e as Error).message, false); }
  }
  async function purge() {
    if (!(await confirmAction("تفسخ الطلبات المتروكة اللي فاتو عليهم أكثر من 30 يوم (ما عدا اللي ولاو طلبيات)؟", false))) return;
    try { const r = await api<{ deleted: number }>("/api/admin/abandoned", { method: "DELETE", body: JSON.stringify({ old: true }) }); toast(`تفسخو ${r.deleted}`); load(); }
    catch (e) { toast((e as Error).message, false); }
  }
  // كي يتصل ولا يبعث واتساب: نعلّموها «تواصلنا معاه» وحدها
  const touched = (c: Row) => { if (c.status === "open") setStatus([c.id], "contacted", true); };

  const c = d?.counts;
  const all = c ? c.open + c.contacted + c.converted + c.ignored : 0;
  const rate = c && all ? Math.round((c.converted / all) * 100) : 0;
  const pages = d ? Math.max(1, Math.ceil(d.total / d.per)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">🛍️ الطلبات المتروكة</h1>
          <p className="mt-1 text-sm text-muted">ناس عمّرو الفورميلار (الرقم على الأقل) وما ضغطوش «أكّد الطلبية». اتصل بيهم ولا ابعثلهم واتساب، وكي يوافقو حوّلها لطلبية بكليك.</p>
        </div>
        <button onClick={purge} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-muted ring-1 ring-line hover:text-navy">🧹 فسخ القدام (+30 يوم)</button>
      </div>

      {d && !d.ready && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm ring-1 ring-amber-200">
          <p className="font-extrabold text-amber-900">⚙️ خطوة وحدة باقية</p>
          <p className="mt-1 text-amber-900">لازم تنفّذ كود SQL تاع الطلبات المتروكة فـ Supabase (SQL Editor ← New query ← الصق ← Run). من بعد كل واحد يعمّر الفورميلار وما يكمّلش يبان هنا.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["🛍️", "متروكة (تستنى)", c?.open, "text-amber-700"],
          ["📞", "تواصلنا معاهم", c?.contacted, "text-sky-700"],
          ["✅", "رجعو طلبيات", c?.converted, "text-ok"],
          ["📈", "نسبة الاسترجاع", c ? `${rate}%` : undefined, "text-brand"],
        ].map(([i, t, v, col]) => (
          <div key={String(t)} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
            <p className="text-xs font-bold text-muted">{i} {t}</p>
            <p className={`mt-1 text-2xl font-extrabold ${col}`}>{v ?? "…"}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button key={t} onClick={() => go({ status: t === "open" ? "" : t })}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ring-1 ${status === t ? "bg-navy text-white ring-navy" : "bg-white text-navy ring-line"}`}>
            {t === "all" ? "الكل" : `${cartStatuses[t].icon} ${cartStatuses[t].label}`}{t !== "all" && c ? ` (${c[t]})` : ""}
          </button>
        ))}
      </div>
      {status === "open" && !!d?.typing && <p className="text-xs text-muted">⏳ {d.typing} زبون راهم يعمّرو الفورميلار دركا — يبانو هنا إذا ما كمّلوش خلال 15 دقيقة.</p>}

      {err ? <p className="rounded-2xl bg-sale/10 p-4 font-semibold text-sale">{err}</p>
        : !d ? <Skeleton rows={6} className="h-28" />
        : d.rows.length === 0 ? <Empty icon="🛍️" text={status === "open" ? "ما كانش طلبات متروكة دركا 👌" : "ما كانش هنا"} />
        : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {d.rows.map((r) => {
              const h = d.history[r.phone];
              const risk = riskOf(h);
              const st = cartStatuses[r.status];
              return (
                <li key={r.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.image ? <img src={r.image} alt="" loading="lazy" className="size-14 shrink-0 rounded-xl object-cover" /> : <span className="size-14 shrink-0 rounded-xl bg-soft" />}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-bold text-navy">{r.product_name}{r.quantity > 1 && <b> ×{r.quantity}</b>}{r.variant && <span className="text-muted"> · {r.variant}</span>}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className={`rounded-full px-2 py-0.5 font-bold ${st.color}`}>{st.icon} {st.label}</span>
                        <span className="text-muted">{timeAgo(r.updated_at)}</span>
                      </p>
                    </div>
                    {!!r.total && <b className="shrink-0 text-lg font-extrabold text-brand">{fmt(r.total)}</b>}
                  </div>

                  <div className="rounded-xl bg-soft p-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <b className="text-navy">{r.name || "بلا اسم"}</b>
                      <a href={`tel:${r.phone}`} dir="ltr" className="font-bold text-brand">{r.phone}</a>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${riskColor[risk.level]}`}>{risk.level === "bad" ? "⚠️ " : risk.level === "good" ? "✅ " : ""}{risk.text}</span>
                      {!!h?.pending && r.status !== "converted" && <Link href={`/admin/customers/${r.phone}`} className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">عندو طلبية أخرى ↗</Link>}
                    </p>
                    <p className="mt-1 text-xs text-muted">📍 {r.wilaya_name ? `${r.wilaya_code} - ${r.wilaya_name}` : "ما اختارش الولاية"}{r.commune && ` · ${r.commune}`} · {r.delivery_method === "desk" ? "🏢 مكتب" : "🏠 دار"}</p>
                    {r.contacted_at && <p className="mt-1 text-xs text-muted">📞 تواصل معاه {r.by || ""} {timeAgo(r.contacted_at)}</p>}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {r.status === "converted" ? (
                      r.order_id && <Link href={`/admin/orders/${r.order_id}`} className="rounded-xl bg-ok px-4 py-2 text-sm font-bold text-white">✅ شوف الطلبية #{r.order_id}</Link>
                    ) : (
                      <>
                        <a href={`tel:${r.phone}`} onClick={() => touched(r)} className="rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white">📞 اتصل</a>
                        <a href={`https://wa.me/${intl(r.phone)}?text=${encodeURIComponent(waText(r))}`} target="_blank" rel="noopener" onClick={() => touched(r)} className="rounded-xl bg-wa px-4 py-2 text-sm font-bold text-white">💬 واتساب</a>
                        {can("orders.edit") && <button onClick={() => setConv(r)} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">✅ حوّلها لطلبية</button>}
                        {r.status !== "ignored"
                          ? <button onClick={() => setStatus([r.id], "ignored")} className="rounded-xl bg-soft px-3 py-2 text-sm font-bold text-muted ring-1 ring-line">🙈 إهمال</button>
                          : <button onClick={() => setStatus([r.id], "open")} className="rounded-xl bg-soft px-3 py-2 text-sm font-bold text-navy ring-1 ring-line">↩️ رجّعها</button>}
                      </>
                    )}
                    {can("orders.delete") && <button onClick={() => remove(r.id)} aria-label="حذف" className="mr-auto rounded-xl px-3 py-2 text-sm text-muted hover:bg-sale/10 hover:text-sale">🗑️</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

      {d && pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => go({ page: String(page - 1) })} className="rounded-lg bg-white px-3 py-2 text-sm font-bold ring-1 ring-line disabled:opacity-40">→</button>
          <span className="text-sm text-muted">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => go({ page: String(page + 1) })} className="rounded-lg bg-white px-3 py-2 text-sm font-bold ring-1 ring-line disabled:opacity-40">←</button>
        </div>
      )}

      {conv && d && <Convert cart={conv} products={d.products} wilayas={d.wilayas} onClose={() => setConv(null)} onDone={(id) => { setConv(null); toast(`✅ ولات طلبية #${id}`); load(); }} />}
    </div>
  );
}

// نافذة التحويل: نكمّلو المعلومات الناقصة مع الزبون فالتيليفون
function Convert({ cart, products, wilayas, onClose, onDone }: { cart: Row; products: P[]; wilayas: W[]; onClose: () => void; onDone: (id: string) => void }) {
  const p = products.find((x) => x.id === cart.product_id);
  const [f, setF] = useState({
    name: cart.name, phone: cart.phone, wilaya: cart.wilaya_code ? String(cart.wilaya_code) : "", method: cart.delivery_method,
    commune: cart.commune, quantity: String(cart.quantity || 1), variant: cart.variant || p?.variants[0] || "",
  });
  const [list, setList] = useState<Commune[] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => { const n = { ...e }; delete n[k]; return n; }); };

  useEffect(() => {
    setList(null);
    if (!f.wilaya) return;
    let alive = true;
    fetch(`/api/communes?w=${f.wilaya}`).then((r) => r.json()).then((d) => alive && setList(Array.isArray(d.communes) && d.communes.length ? d.communes : null)).catch(() => {});
    return () => { alive = false; };
  }, [f.wilaya]);

  const w = wilayas.find((x) => String(x.code) === f.wilaya);
  const shown = list ? (f.method === "desk" ? list.filter((c) => c.desk) : list) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErrors({});
    try {
      const res = await fetch("/api/admin/abandoned", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: cart.id, ...f, wilaya: Number(f.wilaya), quantity: Number(f.quantity) }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) return onDone(data.order);
      if (data.errors) setErrors(data.errors);
      toast(data.error || "صرا مشكل", false);
    } catch { toast("صرا مشكل فالإنترنت", false); }
    setBusy(false);
  }

  const input = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand";
  const err = (k: string) => errors[k] && <p className="mt-1 text-xs font-semibold text-sale">⚠️ {errors[k]}</p>;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-navy/40 p-0 md:place-items-center md:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl md:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-navy">✅ حوّلها لطلبية</h2>
          <button type="button" onClick={onClose} aria-label="سكّر" className="grid size-9 place-items-center rounded-full bg-soft">✕</button>
        </div>
        <p className="rounded-xl bg-soft p-3 text-sm font-bold text-navy">📦 {cart.product_name}</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-bold">الاسم<input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} />{err("name")}</label>
          <label className="text-xs font-bold">الهاتف<input className={input} dir="ltr" value={f.phone} onChange={(e) => set("phone", e.target.value)} />{err("phone")}</label>
        </div>
        {!!p?.variants.length && (
          <label className="block text-xs font-bold">النوع<select className={input} value={f.variant} onChange={(e) => set("variant", e.target.value)}>{p.variants.map((v) => <option key={v}>{v}</option>)}</select>{err("variant")}</label>
        )}
        <label className="block text-xs font-bold">الكمية
          <select className={input} value={f.quantity} onChange={(e) => set("quantity", e.target.value)}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}{p?.offers.includes(n) ? " 🎁 عرض" : ""}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold">الولاية
          <select className={input} value={f.wilaya} onChange={(e) => { set("wilaya", e.target.value); set("commune", ""); }}>
            <option value="">اختار الولاية</option>
            {wilayas.map((x) => <option key={x.code} value={x.code}>{String(x.code).padStart(2, "0")} - {x.name}</option>)}
          </select>{err("wilaya")}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["home", "desk"] as const).map((m) => (
            <button type="button" key={m} disabled={m === "desk" && w?.desk == null} onClick={() => { set("method", m); set("commune", ""); }}
              className={`rounded-xl border-2 p-2.5 text-sm font-bold disabled:opacity-40 ${f.method === m ? "border-brand bg-brand/5 text-brand" : "border-line"}`}>
              {m === "home" ? "🏠 للدار" : "🏢 للمكتب"}{w && <span className="block text-xs font-semibold text-muted">{m === "home" ? fmt(w.home) : w.desk != null ? fmt(w.desk) : "ما كانش"}</span>}
            </button>
          ))}
        </div>
        {err("method")}
        <label className="block text-xs font-bold">{f.method === "desk" ? "المكتب" : "البلدية"}
          {shown ? (
            <select className={input} value={f.commune} onChange={(e) => set("commune", e.target.value)}>
              <option value="">{f.method === "desk" ? "اختار المكتب" : "اختار البلدية"}</option>
              {shown.map((x) => <option key={x.name} value={x.name}>{x.name}{f.method === "home" && x.desk ? " 🏢" : ""}</option>)}
            </select>
          ) : <input className={input} value={f.commune} onChange={(e) => set("commune", e.target.value)} disabled={!f.wilaya} placeholder={f.wilaya ? "البلدية" : "اختار الولاية قبل"} />}
          {err("commune")}
        </label>
        <button disabled={busy} className="w-full rounded-2xl bg-brand py-3.5 font-extrabold text-white disabled:opacity-60">{busy ? "..." : "✅ سجّل الطلبية"}</button>
        <p className="text-center text-xs text-muted">السعر والتوصيل يتحسبو وحدهم كيما فالموقع (العروض والتوصيل المجاني محسوبين).</p>
      </form>
    </div>
  );
}

export default function Page() { return <Suspense><Abandoned /></Suspense>; }
