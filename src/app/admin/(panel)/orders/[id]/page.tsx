"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fmt, timeAgo } from "@/components/admin/api";
import StatusPicker from "@/components/admin/StatusPicker";
import ShipPanel from "@/components/admin/ShipPanel";
import { confirmAction, toast, useCan } from "@/components/admin/ui";
import { statuses, type Order, type Status } from "@/lib/order-types";
import type { Wilaya } from "@/lib/wilayas";

type WaMsg = { id: number; at: string; dir: "in" | "out"; kind: string; body: string; status: string; error?: string | null };
type Data = { carrier: boolean; order: Order; image: string | null; others: Pick<Order, "id" | "status" | "created_at" | "product_name" | "total">[]; blocked: { phone: boolean; ip: boolean };
  messages?: WaMsg[]; carrierStatus?: string | null; checkedAt?: string | null; wa?: boolean };
const waKinds: Record<string, string> = {
  dhi_confirm: "طلب التأكيد", dhi_confirm_reminder: "تذكير", dhi_shipped: "خرجت", dhi_out_for_delivery: "الليفرور جاي", dhi_missed: "ما لقاهش الليفرور",
  dhi_delivered: "وصلت", auto_reply: "رد أوتوماتيك", staff: "رد الفريق", button: "ضغط زر", text: "رسالة الزبون",
};
const waTick: Record<string, string> = { sent: "✓", delivered: "✓✓", read: "✓✓ قراها", failed: "⚠️ ما خرجتش", received: "" };

const fullDate = (iso: string) => new Date(iso).toLocaleString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [carrier, setCarrier] = useState(false);
  const [ship, setShip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inote, setInote] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const can = useCan();

  const load = () => api<Data>(`/api/admin/orders/${id}`).then((r) => { setD(r); setCarrier(r.carrier); }).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <p className="rounded-2xl bg-sale/10 p-4 font-semibold text-sale">{err}</p>;
  if (!d) return <p className="p-8 text-center text-muted">جاري التحميل...</p>;
  const o = d.order;
  const wa = `https://wa.me/${o.phone.replace(/^0/, "213")}?text=${encodeURIComponent(`السلام عليكم ${o.customer_name}، معاك DHI Electronics بخصوص طلبيتك (${o.product_name}) — المجموع ${fmt(o.total)}. نأكدو الطلبية؟`)}`;
  // كي تخرج الطلبية: نفكرو الزبون يخلي تليفونو مفتوح (أكبر سبب تاع الروتور: ما يجاوبش الليفرور)
  const waShip = `https://wa.me/${o.phone.replace(/^0/, "213")}?text=${encodeURIComponent([
    `السلام عليكم ${o.customer_name} 👋`,
    `طلبيتك (${o.product_name}) خرجت مع شركة التوصيل 🚚${o.tracking ? `\nرقم التتبع: ${o.tracking}` : ""}`,
    `الليفرور يعيطلك قريب — خلّي تليفونك مفتوح وحضّر ${fmt(o.total)} 🙏`,
    "إذا كاين أي مشكل عيّطلنا قبل ما ترجعها. شكراً على ثقتك — DHI Electronics",
  ].join("\n"))}`;
  const past = d.others;
  const nDelivered = past.filter((x) => x.status === "delivered").length;
  const nBad = past.filter((x) => x.status === "returned" || x.status === "fake").length;

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try { const r = await api<{ order: Order }>(`/api/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify(body) }); setD((cur) => cur && { ...cur, order: r.order }); toast("تحفظ"); return true; }
    catch (e) { toast((e as Error).message, false); return false; }
    finally { setBusy(false); }
  }

  async function startEdit() {
    setForm({
      customer_name: o.customer_name, phone: o.phone, wilaya_code: String(o.wilaya_code), commune: o.commune, address: o.address || "",
      delivery_method: o.delivery_method, note: o.note || "", quantity: String(o.quantity), unit_price: String(o.unit_price), shipping_fee: String(o.shipping_fee),
    });
    if (!wilayas.length) api<{ wilayas: Wilaya[] }>("/api/admin/settings").then((r) => setWilayas(r.wilayas)).catch(() => {});
    setEdit(true);
  }

  async function block(kind: "phone" | "ip", unblock: boolean) {
    if (!unblock && !(await confirmAction(kind === "phone" ? `تحظر الرقم ${o.phone}؟ الطلبيات الجاية منو ما يوصلوكش.` : `تحظر الـ IP ${o.ip}؟`))) return;
    try { await api("/api/admin/block", { method: "POST", body: JSON.stringify({ [kind]: kind === "phone" ? o.phone : o.ip, unblock }) }); toast(unblock ? "تفك الحظر" : "تحظر"); load(); }
    catch (e) { toast((e as Error).message, false); }
  }

  async function remove() {
    if (!(await confirmAction("تحذف هاد الطلبية نهائياً؟ ما تقدرش ترجعها (الأفضل تبدلها لـ «ملغاة»)."))) return;
    try { await api(`/api/admin/orders/${id}`, { method: "DELETE" }); toast("تحذفت"); router.push("/admin/orders"); } catch (e) { toast((e as Error).message, false); }
  }

  const input = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand";
  const f = (k: string) => ({ value: form[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value }) });
  const Row = ({ k, v, ltr }: { k: string; v: React.ReactNode; ltr?: boolean }) => (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <span className="shrink-0 text-sm text-muted">{k}</span><span className="text-left text-sm font-bold text-navy" dir={ltr ? "ltr" : undefined}>{v}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <Link href="/admin/orders" className="inline-block rounded-xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-line">→ رجوع للطلبات</Link>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line">
        <div className="h-16 bg-gradient-to-l from-navy to-brand" />
        <div className="-mt-10 flex flex-col items-center px-4 pb-5 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {d.image ? <img src={d.image} alt="" className="size-20 rounded-full object-cover ring-4 ring-white" /> : <span className="size-20 rounded-full bg-soft ring-4 ring-white" />}
          <h1 className="mt-2 text-xl font-extrabold text-navy"><Link href={`/admin/customers/${o.phone}`} className="hover:text-brand">{o.customer_name} ↗</Link></h1>
          <p className="text-xs text-muted"><span dir="ltr">#{o.id}</span> · {fullDate(o.created_at)}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <StatusPicker value={o.status} disabled={busy} onPick={(s) => patch({ status: s })} />
            <a href={`tel:${o.phone}`} className="rounded-full bg-navy px-4 py-1.5 text-xs font-bold text-white">📞 اتصل</a>
            <a href={wa} target="_blank" rel="noopener" className="rounded-full bg-wa px-4 py-1.5 text-xs font-bold text-white">💬 واتساب</a>
            {["ready", "shipped"].includes(o.status) && <a href={waShip} target="_blank" rel="noopener" className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-bold text-white">🚚 واتساب: طلبيتك خرجت</a>}
            {!edit && <button onClick={startEdit} className="rounded-full bg-soft px-4 py-1.5 text-xs font-bold text-navy ring-1 ring-line">✏️ تعديل</button>}
            <a href={`/admin/print?ids=${o.id}`} target="_blank" className="rounded-full bg-soft px-4 py-1.5 text-xs font-bold text-navy ring-1 ring-line">🖨️ طباعة</a>
          </div>
        </div>
      </section>

      {nBad > 0 ? (
        <section className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
          <p className="font-extrabold text-red-800">🚨 انتبه: هاد الرقم رجّع ولا كان مزيف {nBad} مرة قبل{nDelivered ? ` (واستلم ${nDelivered})` : ""}</p>
          <p className="mt-1 text-sm text-red-900">أكّد معاه مليح فالتيليفون (الاسم، الولاية، الوقت اللي يكون فيه)، ولا اطلب منو يأكد بالواتساب قبل ما تبعث. إذا عاودها: احظر الرقم.</p>
        </section>
      ) : nDelivered > 0 ? (
        <section className="rounded-2xl bg-green-50 p-4 ring-1 ring-green-200">
          <p className="font-extrabold text-green-800">✅ زبون مضمون: استلم {nDelivered} طلبية قبل</p>
        </section>
      ) : null}

      {d.others.length > 0 && (
        <section className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="font-extrabold text-amber-800">⚠️ هاد الرقم عندو {d.others.length} طلبية أخرى</p>
          <ul className="mt-2 space-y-1 text-sm">
            {d.others.map((x) => (
              <li key={x.id}><Link href={`/admin/orders/${x.id}`} className="flex flex-wrap gap-2 hover:underline">
                <span dir="ltr">#{x.id}</span> · {timeAgo(x.created_at)} · {x.product_name} · <b>{statuses[x.status as Status]?.label}</b>
              </Link></li>
            ))}
          </ul>
        </section>
      )}

      {edit ? (
        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
          <h2 className="font-extrabold text-navy">✏️ تعديل الطلبية</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold">الاسم<input className={input} {...f("customer_name")} /></label>
            <label className="text-xs font-bold">الهاتف<input className={input} dir="ltr" inputMode="tel" {...f("phone")} /></label>
            <label className="text-xs font-bold">الولاية
              <select className={input} {...f("wilaya_code")}>
                {(wilayas.length ? wilayas : [{ code: o.wilaya_code, name: o.wilaya_name } as Wilaya]).map((w) => <option key={w.code} value={w.code}>{String(w.code).padStart(2, "0")} - {w.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold">البلدية<input className={input} {...f("commune")} /></label>
            <label className="text-xs font-bold">طريقة التوصيل
              <select className={input} {...f("delivery_method")}><option value="home">🏠 للدار</option><option value="desk">🏢 للمكتب</option></select>
            </label>
            <label className="text-xs font-bold">العنوان<input className={input} {...f("address")} /></label>
            <label className="text-xs font-bold">الكمية<input className={input} inputMode="numeric" {...f("quantity")} /></label>
            <label className="text-xs font-bold">سعر الوحدة (دج)<input className={input} inputMode="numeric" {...f("unit_price")} /></label>
            <label className="text-xs font-bold">التوصيل (دج)<input className={input} inputMode="numeric" {...f("shipping_fee")} /></label>
            <label className="text-xs font-bold sm:col-span-2">ملاحظة<textarea className={input} rows={2} {...f("note")} /></label>
          </div>
          <div className="flex gap-2">
            <button disabled={busy} onClick={async () => { if (await patch({ ...form, wilaya_code: Number(form.wilaya_code) })) setEdit(false); }} className="flex-1 rounded-xl bg-brand py-3 font-extrabold text-white disabled:opacity-50">💾 حفظ</button>
            <button onClick={() => setEdit(false)} className="rounded-xl bg-soft px-5 font-bold">إلغاء</button>
          </div>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
            <h2 className="mb-2 font-extrabold text-navy">👤 معلومات الزبون</h2>
            <Row k="الإسم كاملا" v={o.customer_name} />
            <Row k="رقم الهاتف" v={<a href={`tel:${o.phone}`} className="text-brand">{o.phone}</a>} ltr />
            <Row k="الولاية" v={`${o.wilaya_code} - ${o.wilaya_name}`} />
            <Row k="البلدية" v={o.commune} />
            <Row k="التوصيل" v={o.delivery_method === "desk" ? "🏢 للمكتب" : `🏠 للدار — ${o.address}`} />
            <Row k="ملاحظة الزبون" v={o.note || "بدون ملاحظة"} />
            <Row k="عنوان الـ IP" v={o.ip || "—"} ltr />
          </section>
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
            <h2 className="mb-2 font-extrabold text-navy">📦 الطلبية</h2>
            <Row k="المنتج" v={`${o.product_name}${o.variant ? ` (${o.variant})` : ""}`} />
            <Row k="سعر الوحدة" v={fmt(o.unit_price)} />
            <Row k="الكمية" v={o.quantity} />
            <Row k="قيمة المنتجات" v={fmt(o.unit_price * o.quantity)} />
            <Row k="التوصيل" v={fmt(o.shipping_fee)} />
            <div className="mt-2 flex items-center justify-between rounded-xl bg-brand/10 p-3"><span className="font-bold">المجموع الكلي</span><span className="text-xl font-extrabold text-brand">{fmt(o.total)}</span></div>
          </section>
        </div>
      )}

      <section className="rounded-2xl bg-amber-50 p-4 shadow-sm ring-1 ring-amber-200">
        <h2 className="mb-2 font-extrabold text-amber-900">📝 ملاحظة داخلية <span className="text-xs font-normal">(للفريق برك، الزبون ما يشوفهاش)</span></h2>
        <textarea rows={2} value={inote ?? o.internal_note ?? ""} onChange={(e) => setInote(e.target.value)} placeholder="مثلا: عيطلو العشية، يحب يستلم السبت..."
          className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
        {inote !== null && inote !== (o.internal_note ?? "") && (
          <button disabled={busy} onClick={async () => { if (await patch({ internal_note: inote })) setInote(null); }} className="mt-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white">💾 حفظ الملاحظة</button>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
        <h2 className="mb-2 font-extrabold text-navy">🚚 التوصيل (World Express)</h2>
        {o.tracking ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>رقم التتبع:</span>
            <a href={`https://suivi.ecotrack.dz/suivi/${o.tracking}`} target="_blank" rel="noopener" className="font-extrabold text-violet-700 underline" dir="ltr">{o.tracking}</a>
            <a href={`/api/admin/shipping/label?tracking=${o.tracking}`} target="_blank" className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-bold text-white">🖨️ البوليصة</a>
            {o.shipped_at && <span className="text-xs text-muted">· تبعثت {timeAgo(o.shipped_at)}</span>}
            {d.carrierStatus && <span className="w-full rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900">📍 عند World Express: <b>{d.carrierStatus}</b>{d.checkedAt && <span className="text-muted"> · {timeAgo(d.checkedAt)}</span>}</span>}
          </div>
        ) : !carrier ? <p className="text-sm text-muted">World Express مازال ما تربطتش.</p>
          : ship ? <ShipPanel o={o} onDone={() => { setShip(false); load(); }} onCancel={() => setShip(false)} />
          : <button onClick={() => setShip(true)} className="w-full rounded-xl bg-violet-700 py-3 text-sm font-bold text-white">🚚 ابعث لـ World Express</button>}
      </section>

      {(d.wa || !!d.messages?.length) && (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
          <h2 className="mb-3 font-extrabold text-navy">💬 واتساب</h2>
          {!d.messages?.length ? <p className="text-sm text-muted">مازال ما خرجت حتى رسالة لهاد الطلبية.</p> : (
            <ul className="space-y-2">
              {d.messages.map((m) => (
                <li key={m.id} className={`flex ${m.dir === "in" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.dir === "in" ? "bg-soft text-navy" : "bg-wa/10 text-navy"}`}>
                    <p className="mb-0.5 text-[11px] font-bold text-muted">{m.dir === "in" ? "👤 الزبون" : "🏪 المتجر"} · {waKinds[m.kind] || m.kind}</p>
                    <p className="whitespace-pre-line">{m.body}</p>
                    <p className="mt-1 text-left text-[10px] text-muted">{timeAgo(m.at)} {waTick[m.status] ?? m.status}</p>
                    {m.error && <p className="text-[11px] font-semibold text-sale">⚠️ {m.error}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {d.wa && can("orders.edit") && (
            <form className="mt-3 flex gap-2" onSubmit={async (e) => {
              e.preventDefault(); if (!reply.trim()) return; setBusy(true);
              try { await api(`/api/admin/orders/${id}/message`, { method: "POST", body: JSON.stringify({ text: reply }) }); setReply(""); toast("خرجت ✅"); load(); }
              catch (err) { toast((err as Error).message, false); }
              setBusy(false);
            }}>
              <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="اكتب رد للزبون…" className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-brand" />
              <button disabled={busy || !reply.trim()} className="rounded-xl bg-wa px-4 text-sm font-bold text-white disabled:opacity-50">ابعث</button>
            </form>
          )}
        </section>
      )}

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
        <h2 className="mb-3 font-extrabold text-navy">🕓 تاريخ حالة الطلب</h2>
        <ol className="relative space-y-3 border-r-2 border-line pr-5">
          {(o.history?.length ? o.history : [{ s: "new", at: o.created_at }]).map((h, i) => {
            const st = statuses[h.s as Status] || statuses.new;
            return (
              <li key={i} className="relative">
                <span className="absolute -right-[29px] top-0.5 grid size-6 place-items-center rounded-full bg-white text-sm ring-2 ring-line">{st.icon}</span>
                <p className="text-sm font-bold">{h.s === "new" && i === 0 ? "إستلام الطلب" : st.label}</p>
                <p className="text-xs text-muted"><span dir="ltr">{fullDate(h.at)}</span>{(h as { by?: string }).by && <> · 👤 {(h as { by?: string }).by}</>}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="flex flex-wrap gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
        <button onClick={() => block("phone", d.blocked.phone)} className={`rounded-xl px-4 py-2.5 text-sm font-bold ring-1 ${d.blocked.phone ? "bg-sale text-white ring-sale" : "text-sale ring-sale/40"}`}>
          {d.blocked.phone ? "🔓 فك حظر الرقم" : "🚫 حظر الرقم"}
        </button>
        {o.ip && <button onClick={() => block("ip", d.blocked.ip)} className={`rounded-xl px-4 py-2.5 text-sm font-bold ring-1 ${d.blocked.ip ? "bg-sale text-white ring-sale" : "text-sale ring-sale/40"}`}>
          {d.blocked.ip ? "🔓 فك حظر الـ IP" : "🚫 حظر الـ IP"}
        </button>}
        {can("orders.delete") && <button onClick={remove} className="mr-auto rounded-xl px-4 py-2.5 text-sm font-bold text-muted ring-1 ring-line hover:text-sale">🗑️ حذف الطلبية</button>}
      </section>
    </div>
  );
}
