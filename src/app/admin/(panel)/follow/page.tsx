"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, fmt, timeAgo } from "@/components/admin/api";
import { Empty, Skeleton, confirmAction, toast, useCan } from "@/components/admin/ui";
import { statuses, type Order, type Status } from "@/lib/order-types";
import { riskColor, riskOf, type PhoneHistory } from "@/lib/abandoned-types";
import { msgLabels, trackUrl, waFor, type MsgKind } from "@/lib/wa-messages";

type Auto = { flags?: { attempts?: { k: string; at: string; by?: string }[]; sent?: Record<string, string> }; carrier_status?: string | null; checked_at?: string | null } | null;
type Row = Order & { auto: Auto };
type Tab = "confirm" | "shipping" | "delivered";
type Res = { tab: Tab; counts: Record<Tab, number>; orders: Row[]; history: Record<string, PhoneHistory>; dups: Record<string, string> };

const tabs: { k: Tab; label: string; hint: string }[] = [
  { k: "confirm", label: "📞 للتأكيد", hint: "اتصل ولا ابعث رسالة التأكيد. الأقدم الفوق: ابدا بيهم." },
  { k: "shipping", label: "🚚 فالطريق", hint: "ابعث «خرجت» نهار تبعثها، و«الليفرور جاي» كي تكون مع الليفرور. هكا ينقص الروتور." },
  { k: "delivered", label: "🎉 وصلو", hint: "شكرهم واطلب رأيهم ولا صورة: آراء حقيقية للموقع." },
];
const quick: Record<Tab, Status[]> = {
  confirm: ["confirmed", "no_answer", "busy", "postponed", "cancelled_client", "fake"],
  shipping: ["delivered", "returned"],
  delivered: [],
};
const msgsFor: Record<Tab, MsgKind[]> = { confirm: ["confirm", "reminder"], shipping: ["shipped", "ofd", "missed"], delivered: ["delivered"] };
const ago = (iso?: string) => (iso ? Date.now() - new Date(iso).getTime() : Infinity);

function Follow() {
  const router = useRouter();
  const sp = useSearchParams();
  const can = useCan();
  const tab = (sp.get("tab") || "confirm") as Tab;
  const [d, setD] = useState<Res | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => api<Res>(`/api/admin/follow?tab=${tab}`).then(setD).catch((e) => setErr(e.message)), [tab]);
  useEffect(() => { setD(null); load(); }, [load]);

  // نسجلو المحاولة (بلا ما نستناو) ومن بعد يتحل الواتساب ولا المكالمة
  function contact(o: Row, kind: string) {
    if (!can("orders.edit")) return;
    const at = new Date().toISOString();
    setD((cur) => cur && { ...cur, orders: cur.orders.map((x) => x.id !== o.id ? x : {
      ...x, auto: { ...(x.auto || {}), flags: { ...(x.auto?.flags || {}), attempts: [...(x.auto?.flags?.attempts || []), { k: kind, at }], sent: kind === "call" ? x.auto?.flags?.sent : { ...(x.auto?.flags?.sent || {}), [kind]: at } } },
    }) });
    api("/api/admin/follow", { method: "POST", body: JSON.stringify({ id: o.id, kind }) }).catch((e) => toast(e.message, false));
  }

  async function setStatus(o: Row, s: Status) {
    if (["cancelled_client", "fake", "returned", "delivered"].includes(s) && !(await confirmAction(`تبدّل #${o.id} لـ «${statuses[s].label}»؟`, s !== "delivered"))) return;
    try {
      const r = await api<{ errors?: string[] }>("/api/admin/orders", { method: "PATCH", body: JSON.stringify({ ids: [o.id], status: s }) });
      if (r.errors?.length) return toast(r.errors.join(" — "), false);
      toast(`«${statuses[s].label}»`);
      load();
    } catch (e) { toast((e as Error).message, false); }
  }

  const t = tabs.find((x) => x.k === tab)!;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-navy">📲 التأكيد والمتابعة</h1>
        <p className="mt-1 text-sm text-muted">كل رسالة جاهزة: اضغط عليها، يتحل الواتساب تاعك والرسالة مكتوبة، غير اضغط «إرسال». <b>بلاش</b> ومن الأرقام تاعك.</p>
        <p className="mt-1 text-xs text-muted">💡 فالكمبيوتر حل <b>WhatsApp Web</b> بالرقم اللي تحب تبعث منو قبل ما تبدا.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((x) => (
          <button key={x.k} onClick={() => router.push(`/admin/follow?tab=${x.k}`)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ring-1 ${tab === x.k ? "bg-navy text-white ring-navy" : "bg-white text-navy ring-line"}`}>
            {x.label}{d?.counts ? ` (${d.counts[x.k] ?? 0})` : ""}
          </button>
        ))}
      </div>
      <p className="rounded-xl bg-brand/5 px-3 py-2 text-xs font-semibold text-navy">{t.hint}</p>

      {err ? <p className="rounded-2xl bg-sale/10 p-4 font-semibold text-sale">{err}</p>
        : !d ? <Skeleton rows={5} className="h-40" />
        : d.orders.length === 0 ? <Empty icon="👌" text="ما كانش طلبيات هنا دركا" />
        : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {d.orders.map((o) => {
              const f = o.auto?.flags || {};
              const att = f.attempts || [];
              const calls = att.filter((a) => a.k === "call").length;
              const msgs = att.filter((a) => a.k !== "call").length;
              const last = att[att.length - 1];
              const risk = riskOf(d.history[o.phone]);
              const again = tab === "confirm" && last && ago(last.at) > 2 * 3600_000;
              const st = statuses[o.status as Status];
              return (
                <li key={o.id} className={`flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ${again ? "ring-amber-300" : "ring-line"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/admin/orders/${o.id}`} className="font-extrabold text-navy hover:text-brand">{o.customer_name} ↗</Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <a href={`tel:${o.phone}`} onClick={() => contact(o, "call")} className="font-bold text-brand" dir="ltr">{o.phone}</a>
                        {st && <span className={`rounded-full px-2 py-0.5 font-bold ${st.color}`}>{st.icon} {st.label}</span>}
                        {risk.level !== "new" && <span className={`rounded-full px-2 py-0.5 font-bold ${riskColor[risk.level]}`}>{risk.level === "bad" ? "⚠️ " : risk.level === "good" ? "✅ " : ""}{risk.text}</span>}
                        {d.dups[o.id] && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">📑 مكررة؟</span>}
                      </p>
                    </div>
                    <b className="shrink-0 text-lg font-extrabold text-brand">{fmt(o.total)}</b>
                  </div>

                  <div className="rounded-xl bg-soft p-3 text-sm">
                    <p className="font-bold text-navy">📦 {o.product_name}{o.variant && ` (${o.variant})`}{o.quantity > 1 && ` × ${o.quantity}`}</p>
                    <p className="mt-0.5 text-xs text-muted">📍 {o.wilaya_code} - {o.wilaya_name}{o.commune && ` · ${o.commune}`} · {o.delivery_method === "desk" ? "🏢 مكتب" : "🏠 دار"} · 🕓 {timeAgo(o.created_at)}</p>
                    {tab === "shipping" && (
                      <p className="mt-1 text-xs">
                        {o.tracking ? <a href={trackUrl(o.tracking)} target="_blank" rel="noopener" className="font-bold text-violet-700 underline" dir="ltr">{o.tracking}</a> : <span className="text-muted">بلا رقم تتبع</span>}
                        {o.auto?.carrier_status && <span className="text-violet-900"> · 📍 {o.auto.carrier_status}</span>}
                      </p>
                    )}
                    {att.length > 0 && (
                      <p className={`mt-1 text-xs ${again ? "font-bold text-amber-800" : "text-muted"}`}>
                        {calls > 0 && `📞×${calls} `}{msgs > 0 && `💬×${msgs} `}· آخر محاولة {timeAgo(last.at)}{last.by ? ` (${last.by})` : ""}{again && " ← ⏰ عاود"}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a href={`tel:${o.phone}`} onClick={() => contact(o, "call")} className="rounded-xl bg-navy px-3.5 py-2 text-sm font-bold text-white">📞 اتصل</a>
                    {msgsFor[tab].map((k) => {
                      const sentAt = f.sent?.[k];
                      return (
                        <a key={k} href={waFor(k, o)} target="_blank" rel="noopener" onClick={() => contact(o, k)}
                          className={`rounded-xl px-3.5 py-2 text-sm font-bold ${sentAt ? "bg-wa/15 text-green-800 ring-1 ring-wa/40" : "bg-wa text-white"}`}>
                          💬 {msgLabels[k]}{sentAt && <span className="text-[11px] font-semibold"> ✓ {timeAgo(sentAt)}</span>}
                        </a>
                      );
                    })}
                  </div>

                  {can("orders.edit") && quick[tab].length > 0 && (
                    <div className="flex flex-wrap gap-1.5 border-t border-dashed border-line pt-3">
                      {quick[tab].filter((s) => s !== o.status).map((s) => (
                        <button key={s} onClick={() => setStatus(o, s)} className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${statuses[s].color}`}>{statuses[s].icon} {statuses[s].label}</button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}

export default function Page() { return <Suspense><Follow /></Suspense>; }
