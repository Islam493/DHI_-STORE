"use client";
import { useEffect, useRef, useState } from "react";
import { confirmAction, toast } from "@/components/admin/ui";
import { api, timeAgo } from "@/components/admin/api";
import { uploadFile } from "@/components/admin/upload";
import type { Review } from "@/lib/review-types";
import type { Product } from "@/lib/catalog";

const empty = { product_id: "", name: "", wilaya: "", rating: 5, text: "", image: "", order_id: "" };

// سطر: الاسم | الولاية | النجوم | الرأي  (الولاية والنجوم اختياريين)
function parseLine(l: string) {
  const p = l.split("|").map((x) => x.trim());
  if (p.length < 2) return null;
  const name = p[0], text = p[p.length - 1];
  const mid = p.slice(1, -1);
  const starIdx = mid.findIndex((x) => /^[1-5]$/.test(x) || /^★{1,5}$/.test(x));
  const rating = starIdx >= 0 ? (/^★/.test(mid[starIdx]) ? mid[starIdx].length : Number(mid[starIdx])) : 5;
  const wilaya = mid.filter((_, k) => k !== starIdx)[0] || "";
  return { name, wilaya, rating, text };
}

export default function Reviews() {
  const [list, setList] = useState<Review[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [f, setF] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const shotsRef = useRef<HTMLInputElement>(null);
  const [bulkTab, setBulkTab] = useState<"text" | "shots">("text");
  const [bulkProduct, setBulkProduct] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkMsg, setBulkMsg] = useState("");
  const [shotProgress, setShotProgress] = useState("");
  const parsed = bulkText.split("\n").map((l) => l.trim()).filter(Boolean).map(parseLine);
  const okLines = parsed.filter(Boolean) as NonNullable<ReturnType<typeof parseLine>>[];

  const load = () => api<{ reviews: Review[] }>("/api/admin/reviews").then((d) => setList(d.reviews)).catch((e) => setErr(e.message));
  useEffect(() => { load(); api<{ products: Product[] }>("/api/admin/products").then((d) => setProducts(d.products)).catch(() => {}); }, []);

  async function save() {
    setBusy(true); setErr("");
    try {
      if (editId) await api(`/api/admin/reviews/${editId}`, { method: "PUT", body: JSON.stringify(f) });
      else await api("/api/admin/reviews", { method: "POST", body: JSON.stringify(f) });
      setF(empty); setEditId(null); load();
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  async function upload(files: FileList | null) {
    if (!files?.[0]) return;
    setBusy(true);
    try { setF({ ...f, image: await uploadFile(files[0]) }); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  async function addBulk() {
    if (!okLines.length) return;
    setBusy(true); setBulkMsg("");
    try {
      const d = await api<{ added: number }>("/api/admin/reviews", { method: "POST", body: JSON.stringify({ items: okLines.map((x) => ({ ...x, product_id: bulkProduct })) }) });
      setBulkMsg(`✅ تزادو ${d.added} آراء`); setBulkText(""); load();
    } catch (e) { setBulkMsg("⚠️ " + (e as Error).message); }
    setBusy(false);
  }
  async function addShots(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setBulkMsg("");
    const urls: string[] = [];
    try {
      for (const [k, file] of Array.from(files).entries()) {
        setShotProgress(`📤 ${k + 1} / ${files.length}`);
        urls.push(await uploadFile(file));
      }
      const d = await api<{ added: number }>("/api/admin/reviews", { method: "POST", body: JSON.stringify({ items: urls.map((image) => ({ product_id: bulkProduct, name: "رسالة زبون", text: "", image })) }) });
      setBulkMsg(`✅ تزادو ${d.added} سكرينات`); load();
    } catch (e) { setBulkMsg("⚠️ " + (e as Error).message); }
    setShotProgress(""); setBusy(false);
    if (shotsRef.current) shotsRef.current.value = "";
  }
  async function toggle(r: Review) {
    await api(`/api/admin/reviews/${r.id}`, { method: "PUT", body: JSON.stringify({ visible: !r.visible }) }).catch((e) => toast(e.message, false));
    load();
  }
  async function remove(r: Review) {
    if (!(await confirmAction("تحذف هاد الرأي؟"))) return;
    await api(`/api/admin/reviews/${r.id}`, { method: "DELETE" }).catch((e) => toast(e.message, false));
    load();
  }

  const input = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base outline-none focus:border-brand";
  const pname = (id: string | null) => (id ? products.find((p) => p.id === id)?.name || "منتج" : "المتجر كامل");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-navy">⭐ آراء الزبائن</h1>
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
        ⚠️ زيد غير آراء <b>حقيقية</b> من زبائنك (رسائل واتساب، تعليقات فيسبوك...) وبإذنهم. إذا كتبت <b>رقم الطلبية</b> وكانت <b>مكتملة</b>، الرأي ياخذ علامة «✓ شراء مؤكد» وحدو.
      </p>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
        <h2 className="font-extrabold text-navy">📥 زيد بزاف آراء مرة وحدة</h2>
        <label className="block text-sm font-bold">المنتج
          <select className={input} value={bulkProduct} onChange={(e) => setBulkProduct(e.target.value)}>
            <option value="">— المتجر كامل (يبانو فكل المنتجات اللي ما عندهمش آراء) —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="flex gap-2 rounded-xl bg-soft p-1 text-sm font-bold">
          <button type="button" onClick={() => setBulkTab("text")} className={`flex-1 rounded-lg py-2 ${bulkTab === "text" ? "bg-white shadow" : ""}`}>✍️ آراء مكتوبة</button>
          <button type="button" onClick={() => setBulkTab("shots")} className={`flex-1 rounded-lg py-2 ${bulkTab === "shots" ? "bg-white shadow" : ""}`}>📸 سكرينات الرسائل</button>
        </div>
        {bulkTab === "text" ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">كل سطر رأي: <b dir="rtl">الاسم | الولاية | النجوم | الرأي</b> — الولاية والنجوم اختياريين (النجوم من 1 حتى 5). مثال:<br /><span className="font-mono">محمد ب. | وهران | 5 | الكاميرا وصلت فيومين وتخدم مليح</span></p>
            <textarea className={`${input} min-h-36`} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={"محمد ب. | وهران | 5 | الكاميرا وصلت فيومين وتخدم مليح\nسارة | 4 | الصورة واضحة حتى فالليل"} />
            {parsed.length > 0 && <p className="text-xs font-bold">{okLines.length} رأي جاهز{parsed.length > okLines.length && <span className="text-sale"> · {parsed.length - okLines.length} سطر ناقص (لازم الاسم | الرأي على الأقل)</span>}</p>}
            {okLines.length > 0 && (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl bg-soft p-2 text-xs">
                {okLines.map((x, k) => <li key={k}><b>{x.name}</b>{x.wilaya && ` · ${x.wilaya}`} · <span className="text-amber-500" dir="ltr">{"★".repeat(x.rating)}</span> — {x.text}</li>)}
              </ul>
            )}
            <button onClick={addBulk} disabled={busy || !okLines.length} className="w-full rounded-xl bg-brand py-3 font-extrabold text-white disabled:opacity-40">➕ زيد {okLines.length || ""} آراء</button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted">اختار سكرينات رسائل الزبائن (واتساب، فيسبوك، إنستغرام...) — تقدر تختار بزاف مرة وحدة. يبانو فمعرض «📸 من رسائل زبائننا»، وما يدخلوش فحساب النجوم. خبّي أرقام الهاتف قبل.</p>
            <button type="button" onClick={() => shotsRef.current?.click()} disabled={busy} className="w-full rounded-xl border-2 border-dashed border-brand/40 bg-brand/5 py-6 font-extrabold text-brand disabled:opacity-50">{shotProgress || "📸 اختار السكرينات"}</button>
            <input ref={shotsRef} type="file" accept="image/*" multiple hidden onChange={(e) => addShots(e.target.files)} />
          </div>
        )}
        {bulkMsg && <p className="rounded-xl bg-soft p-2 text-sm font-bold">{bulkMsg}</p>}
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
        <h2 className="font-extrabold text-navy">{editId ? "✏️ تعديل الرأي" : "➕ زيد رأي واحد"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold">المنتج
            <select className={input} value={f.product_id} onChange={(e) => setF({ ...f, product_id: e.target.value })}>
              <option value="">— المتجر كامل —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">التقييم
            <div className="flex gap-1 pt-1" dir="ltr">
              {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setF({ ...f, rating: n })} className={`text-3xl ${n <= f.rating ? "text-amber-400" : "text-gray-300"}`}>★</button>)}
            </div>
          </label>
          <label className="text-sm font-bold">اسم الزبون<input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="مثلا: محمد ب." /></label>
          <label className="text-sm font-bold">الولاية<input className={input} value={f.wilaya} onChange={(e) => setF({ ...f, wilaya: e.target.value })} placeholder="اختياري" /></label>
          <label className="text-sm font-bold sm:col-span-2">الرأي<textarea className={input} rows={3} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="واش قال الزبون بالضبط" /></label>
          <label className="text-sm font-bold">رقم الطلبية <span className="font-normal text-muted">(اختياري، للشراء المؤكد)</span><input className={input} dir="ltr" value={f.order_id} onChange={(e) => setF({ ...f, order_id: e.target.value })} placeholder="MWL2H8LF25" /></label>
          <div className="text-sm font-bold">سكرين / صورة <span className="font-normal text-muted">(اختياري)</span>
            <div className="mt-1 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {f.image && <img src={f.image} alt="" className="size-14 rounded-lg object-cover" />}
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl bg-soft px-4 py-2.5 text-sm font-bold ring-1 ring-line">📷 {f.image ? "بدّل" : "زيد صورة"}</button>
              {f.image && <button type="button" onClick={() => setF({ ...f, image: "" })} className="text-xs font-bold text-sale">حذف</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files)} />
          </div>
        </div>
        {err && <p className="rounded-xl bg-sale/10 p-2 text-sm font-semibold text-sale">{err}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="flex-1 rounded-xl bg-brand py-3 font-extrabold text-white disabled:opacity-50">{busy ? "..." : editId ? "💾 حفظ التعديل" : "➕ زيد الرأي"}</button>
          {editId && <button onClick={() => { setEditId(null); setF(empty); }} className="rounded-xl bg-soft px-5 font-bold">إلغاء</button>}
        </div>
      </section>

      {!list ? <p className="p-6 text-center text-muted">{err || "جاري التحميل..."}</p> : list.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-muted ring-1 ring-line">مازال ما زدت حتى رأي</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((r) => (
            <li key={r.id} className={`rounded-2xl bg-white p-4 ring-1 ring-line ${r.visible ? "" : "opacity-50"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-extrabold text-navy">{r.name} {r.wilaya && <span className="text-xs font-normal text-muted">· {r.wilaya}</span>}</p>
                  <p className="text-amber-400" dir="ltr">{"★".repeat(r.rating)}<span className="text-gray-300">{"★".repeat(5 - r.rating)}</span></p>
                </div>
                {r.verified && <span className="rounded-full bg-ok/10 px-2 py-0.5 text-xs font-bold text-ok">✓ شراء مؤكد</span>}
              </div>
              <p className="mt-2 text-sm leading-6">{r.text}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.image && <img src={r.image} alt="" className="mt-2 max-h-40 rounded-lg" />}
              <p className="mt-2 text-xs text-muted">{pname(r.product_id)} · {timeAgo(r.created_at)}</p>
              <div className="mt-3 flex gap-2 text-xs font-bold">
                <button onClick={() => { setEditId(r.id); setF({ product_id: r.product_id || "", name: r.name, wilaya: r.wilaya, rating: r.rating, text: r.text, image: r.image || "", order_id: r.order_id || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-lg bg-soft px-3 py-1.5">✏️ تعديل</button>
                <button onClick={() => toggle(r)} className="rounded-lg bg-soft px-3 py-1.5">{r.visible ? "🙈 خبّي" : "👁️ بيّن"}</button>
                <button onClick={() => remove(r)} className="mr-auto rounded-lg px-3 py-1.5 text-sale">🗑️</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
