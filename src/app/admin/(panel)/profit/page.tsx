"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, fmt } from "@/components/admin/api";
import { NoAccess, Skeleton, toast, useCan, useMe } from "@/components/admin/ui";

type Fee = { home: number | null; desk: number | null };
type Res = {
  range: { from: string; to: string };
  summary: { delivered: number; revenue: number; goods: number; carrier: number; cod: number; deliveredProfit: number; returned: number; returnLoss: number; pipeline: number; pipelineProfit: number; missing: number; net: number; margin: number | null };
  products: { product_id: string; name: string; delivered: number; returned: number; revenue: number; goods: number; carrier: number; profit: number }[];
  orders: { id: string; created_at: string; status: string; customer_name: string; wilaya_name: string; delivery_method: string; product_name: string; quantity: number; total: number; goods: number; fee: number; cod: number; profit: number; missing: boolean }[];
  costs: { id: string; name: string; image: string | null; price: number; cost: number | null }[];
  settings: { carrierFees: Record<string, Fee>; returnFee: number; codPercent: number };
  wilayas: { code: number; name: string }[];
  carrierConnected: boolean;
};

const ago = (n: number) => new Date(Date.now() + 3600_000 - n * 86400_000).toISOString().slice(0, 10);
const money = (n: number) => <span className={n < 0 ? "text-sale" : ""} dir="ltr">{fmt(n)}</span>;

function Profit() {
  const can = useCan();
  const me = useMe();
  const router = useRouter();
  const sp = useSearchParams();
  const [d, setD] = useState<Res | null>(null);
  const [tab, setTab] = useState<"report" | "costs" | "fees">("report");
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [fees, setFees] = useState<Record<string, { home: string; desk: string }>>({});
  const [extra, setExtra] = useState({ returnFee: "", codPercent: "" });
  const [busy, setBusy] = useState(false);
  const key = sp.toString();

  const load = () => api<Res>(`/api/admin/profit?${key}`).then((r) => {
    setD(r);
    setCosts(Object.fromEntries(r.costs.map((c) => [c.id, c.cost == null ? "" : String(c.cost)])));
    setFees(Object.fromEntries(r.wilayas.map((w) => { const f = r.settings.carrierFees[w.code]; return [w.code, { home: f?.home == null ? "" : String(f.home), desk: f?.desk == null ? "" : String(f.desk) }]; })));
    setExtra({ returnFee: String(r.settings.returnFee || ""), codPercent: String(r.settings.codPercent || "") });
  }).catch((e) => toast(e.message, false));
  useEffect(() => { if (me && can("stats.view")) load(); }, [key, me]); // eslint-disable-line react-hooks/exhaustive-deps

  if (me && !can("stats.view")) return <NoAccess />;
  if (!d) return <div className="space-y-3"><Skeleton rows={1} className="h-14" /><Skeleton rows={2} className="h-32" /></div>;
  const s = d.summary;
  const setRange = (from: string, to: string) => router.push(`/admin/profit?from=${from}&to=${to}`);
  const missingCosts = d.costs.filter((c) => c.cost == null).length;
  const missingFees = d.wilayas.filter((w) => !d.settings.carrierFees[w.code]?.home).length;

  async function post(body: Record<string, unknown>, msg: string) {
    setBusy(true);
    try { await api("/api/admin/profit", { method: "POST", body: JSON.stringify(body) }); toast(msg); await load(); }
    catch (e) { toast((e as Error).message, false); }
    setBusy(false);
  }
  async function fetchFees() {
    setBusy(true);
    try {
      const r = await api<{ fees: Record<string, Fee>; found: number; keys: string[] }>("/api/admin/profit", { method: "POST", body: JSON.stringify({ action: "fetch_fees" }) });
      if (!r.found) { toast(`World Express ردّت بشكل ما فهمناهش (${r.keys.join(", ") || "فارغ"}). عمّر الأسعار باليد.`, false); }
      else {
        setFees((cur) => Object.fromEntries(Object.entries(cur).map(([k, v]) => { const f = r.fees[k]; return [k, f ? { home: f.home == null ? v.home : String(f.home), desk: f.desk == null ? v.desk : String(f.desk) } : v]; })));
        toast(`جبنا أسعار ${r.found} ولاية من World Express. راجعهم واضغط «حفظ».`);
      }
    } catch (e) { toast((e as Error).message, false); }
    setBusy(false);
  }

  const input = "w-full rounded-lg border border-line bg-white px-2 py-2 text-center text-sm outline-none focus:border-brand";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-navy">💹 الأرباح</h1>
      {(missingCosts > 0 || missingFees > 0) && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          ⚠️ باش يكون الربح دقيق:
          {missingCosts > 0 && <> <button onClick={() => setTab("costs")} className="font-extrabold underline">زيد سعر الشراء لـ {missingCosts} منتج</button></>}
          {missingCosts > 0 && missingFees > 0 && " و"}
          {missingFees > 0 && <> <button onClick={() => setTab("fees")} className="font-extrabold underline">أسعار World Express لـ {missingFees} ولاية</button></>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {([["report", "📊 التقرير"], ["costs", "🏷️ أسعار الشراء"], ["fees", "🚚 أسعار World Express"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-2 text-sm font-bold ring-1 ${tab === k ? "bg-navy text-white ring-navy" : "bg-white ring-line"}`}>{l}</button>
        ))}
      </div>

      {tab === "report" && (<>
        <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-white p-3 ring-1 ring-line">
          {[["7 أيام", ago(6)], ["30 يوم", ago(29)], ["90 يوم", ago(89)]].map(([l, f]) => (
            <button key={l} onClick={() => setRange(f, ago(0))} className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${d.range.from === f ? "bg-brand text-white ring-brand" : "ring-line"}`}>{l}</button>
          ))}
          <label className="text-xs font-bold text-muted">من<input type="date" value={d.range.from} onChange={(e) => setRange(e.target.value, d.range.to)} className="mr-1 rounded-lg border border-line px-2 py-1.5 text-sm" /></label>
          <label className="text-xs font-bold text-muted">حتى<input type="date" value={d.range.to} onChange={(e) => setRange(d.range.from, e.target.value)} className="mr-1 rounded-lg border border-line px-2 py-1.5 text-sm" /></label>
        </div>

        <div className="rounded-3xl bg-gradient-to-l from-navy to-navy-2 p-5 text-white">
          <p className="text-sm font-bold text-white/70">💰 الربح الصافي</p>
          <p className={`mt-1 text-4xl font-extrabold ${s.net < 0 ? "text-red-300" : ""}`} dir="ltr">{fmt(s.net)}</p>
          <p className="mt-1 text-sm text-white/70">هامش الربح: <b>{s.margin ?? "—"}%</b> · {s.delivered} مستلمة · {s.returned} مرجعة</p>
          {s.missing > 0 && <p className="mt-2 text-xs text-amber-300">⚠️ {s.missing} طلبية ناقصها سعر الشراء ولا سعر التوصيل (تحسبت بـ 0)</p>}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[["✅ اللي خلصوه الزبائن", s.revenue, ""], ["🏷️ سعر السلعة", -s.goods, ""], ["🚚 World Express", -s.carrier, ""], ["💳 العمولة", -s.cod, ""], ["↩️ خسارة المرجوع", s.returnLoss, `${s.returned} طرد`]].map(([l, v, sub]) => (
            <div key={l as string} className="rounded-2xl bg-white p-4 ring-1 ring-line"><p className="text-xs font-bold text-muted">{l}</p><p className="mt-1 text-lg font-extrabold text-navy">{money(v as number)}</p>{sub && <p className="text-[11px] text-muted">{sub}</p>}</div>
          ))}
        </div>
        {s.pipeline > 0 && <p className="rounded-2xl bg-white p-4 text-sm ring-1 ring-line">⏳ الربح المنتظر من <b>{s.pipeline}</b> طلبية مؤكدة / عند التوصيل: <b className="text-ok">{money(s.pipelineProfit)}</b> (إذا تسلّمو كامل)</p>}

        <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
          <h2 className="p-4 font-extrabold text-navy">📦 الربح حسب المنتج</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="border-y border-line text-right text-xs text-muted"><tr><th className="p-3">المنتج</th><th className="p-3 text-center">مستلمة</th><th className="p-3 text-center">مرجعة</th><th className="p-3">المداخيل</th><th className="p-3">السلعة</th><th className="p-3">التوصيل</th><th className="p-3">الربح</th></tr></thead>
              <tbody className="divide-y divide-line">
                {d.products.map((p) => (
                  <tr key={p.product_id}><td className="p-3 font-bold">{p.name}</td><td className="p-3 text-center text-ok">{p.delivered}</td><td className="p-3 text-center text-sale">{p.returned}</td><td className="p-3">{money(p.revenue)}</td><td className="p-3">{money(-p.goods)}</td><td className="p-3">{money(-p.carrier)}</td><td className="p-3 font-extrabold">{money(p.profit)}</td></tr>
                ))}
                {d.products.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted">ما كانش طلبيات مستلمة ولا مرجعة فهاد الفترة</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
          <h2 className="p-4 font-extrabold text-navy">🧾 الربح فكل طلبية</h2>
          <ul className="divide-y divide-line">
            {d.orders.map((o) => (
              <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm hover:bg-soft">
                <span className="min-w-0 flex-1"><b>{o.customer_name}</b> <span className="text-xs text-muted">· {o.wilaya_name} · {o.product_name} ×{o.quantity}</span></span>
                <span className="text-xs text-muted">{o.status === "returned" ? "↩️ مرجع" : `${fmt(o.total)} − ${fmt(o.goods)} − ${fmt(o.fee + o.cod)}`}</span>
                <b className={o.profit < 0 ? "text-sale" : "text-ok"} dir="ltr">{fmt(o.profit)}</b>
                {o.missing && <span title="ناقص سعر الشراء ولا التوصيل">⚠️</span>}
              </Link></li>
            ))}
            {d.orders.length === 0 && <li className="p-6 text-center text-muted">ما كانش طلبيات</li>}
          </ul>
        </section>
      </>)}

      {tab === "costs" && (
        <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
          <p className="text-sm text-muted">اكتب بشحال تشري كل منتج (القطعة). هادي ما تبانش للزبائن ولا للموظفين.</p>
          <ul className="divide-y divide-line">
            {d.costs.map((c) => {
              const v = Number(costs[c.id]); const m = costs[c.id] !== "" && v > 0 ? c.price - v : null;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.image ? <img src={c.image} alt="" loading="lazy" className="size-11 rounded-lg object-cover" /> : <span className="size-11 rounded-lg bg-soft" />}
                  <span className="min-w-0 flex-1"><span className="line-clamp-1 text-sm font-bold">{c.name}</span><span className="text-xs text-muted">سعر البيع: {fmt(c.price)}{m !== null && <> · الفرق: <b className={m < 0 ? "text-sale" : "text-ok"}>{fmt(m)}</b></>}</span></span>
                  <input className={`${input} w-32`} inputMode="numeric" placeholder="سعر الشراء" value={costs[c.id] ?? ""} onChange={(e) => setCosts({ ...costs, [c.id]: e.target.value.replace(/\D/g, "") })} />
                </li>
              );
            })}
          </ul>
          <button disabled={busy} onClick={() => post({ action: "save_costs", costs }, "تحفظو أسعار الشراء")} className="w-full rounded-xl bg-brand py-3 font-extrabold text-white disabled:opacity-50">💾 حفظ أسعار الشراء</button>
        </section>
      )}

      {tab === "fees" && (
        <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
          <p className="text-sm text-muted">هادو الأسعار اللي <b>تخلصهم انت</b> لـ World Express (ماشي اللي يخلصهم الزبون).</p>
          {d.carrierConnected && <button disabled={busy} onClick={fetchFees} className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">🔄 جيب الأسعار من World Express</button>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-bold">↩️ مصاريف الطرد المرجوع (دج)<input className={input} inputMode="numeric" value={extra.returnFee} onChange={(e) => setExtra({ ...extra, returnFee: e.target.value.replace(/\D/g, "") })} placeholder="مثلا 200" /></label>
            <label className="text-sm font-bold">💳 عمولة الدفع عند الاستلام (%)<input className={input} inputMode="decimal" value={extra.codPercent} onChange={(e) => setExtra({ ...extra, codPercent: e.target.value.replace(/[^\d.]/g, "") })} placeholder="0" /></label>
          </div>
          <div className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 text-sm">
            <span className="font-bold text-muted">الولاية</span><span className="text-center font-bold text-muted">🏠 دار</span><span className="text-center font-bold text-muted">🏢 مكتب</span>
            {d.wilayas.map((w) => (
              <div key={w.code} className="contents">
                <span className="truncate">{String(w.code).padStart(2, "0")} {w.name}</span>
                <input className={input} inputMode="numeric" value={fees[w.code]?.home ?? ""} onChange={(e) => setFees({ ...fees, [w.code]: { ...fees[w.code], home: e.target.value.replace(/\D/g, "") } })} />
                <input className={input} inputMode="numeric" value={fees[w.code]?.desk ?? ""} placeholder="—" onChange={(e) => setFees({ ...fees, [w.code]: { ...fees[w.code], desk: e.target.value.replace(/\D/g, "") } })} />
              </div>
            ))}
          </div>
          <button disabled={busy} onClick={() => post({ action: "save_fees", carrierFees: fees, returnFee: extra.returnFee, codPercent: extra.codPercent }, "تحفظو الأسعار")} className="w-full rounded-xl bg-brand py-3 font-extrabold text-white disabled:opacity-50">💾 حفظ</button>
        </section>
      )}
    </div>
  );
}

export default function Page() { return <Suspense><Profit /></Suspense>; }
