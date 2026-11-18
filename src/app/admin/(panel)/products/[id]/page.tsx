"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/admin/api";
import { categories } from "@/lib/categories";
import type { Product, Variant } from "@/lib/catalog";

type Form = {
  name: string; slug: string; tagline: string; category: string; active: boolean;
  price: string; compareAtPrice: string; description: string; images: string[]; variants: { name: string; price: string }[];
};

const empty: Form = { name: "", slug: "", tagline: "", category: categories[0].slug, active: true, price: "", compareAtPrice: "", description: "", images: [], variants: [] };

// نصغرو الصورة فالتيليفون قبل ما نرفعوها (أسرع + أقل من الحد)
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return file;
  const max = 1600;
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob((b) => r(b || file), "image/webp", 0.85));
}

export default function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === "new";
  const router = useRouter();
  const [f, setF] = useState<Form | null>(isNew ? empty : null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew) return;
    api<{ products: Product[] }>("/api/admin/products").then(({ products }) => {
      const p = products.find((x) => x.id === id);
      if (!p) { setErr("المنتج ما كانش"); return; }
      setF({
        name: p.name, slug: p.slug, tagline: p.tagline, category: p.category, active: p.active,
        price: String(p.price), compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : "",
        description: p.description.join("\n"), images: p.images,
        variants: p.variants.map((v: Variant) => ({ name: v.name, price: String(v.price) })),
      });
    }).catch((e) => setErr(e.message));
  }, [id, isNew]);

  if (!f) return <p className="p-8 text-center text-muted">{err || "جاري التحميل..."}</p>;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setErr("");
    const list = Array.from(files).slice(0, 10);
    setUploading(list.length);
    const urls: string[] = [];
    for (const file of list) {
      try {
        const blob = await shrink(file);
        const fd = new FormData();
        fd.append("file", blob, file.name.replace(/\.[^.]+$/, "") + (blob.type === "image/webp" ? ".webp" : ".jpg"));
        const { url } = await api<{ url: string }>("/api/admin/upload", { method: "POST", body: fd });
        urls.push(url);
      } catch (e) { setErr((e as Error).message); }
      setUploading((n) => n - 1);
    }
    setF((cur) => cur && { ...cur, images: [...cur.images, ...urls] });
    if (fileRef.current) fileRef.current.value = "";
  }

  const moveFirst = (i: number) => set("images", [f.images[i], ...f.images.filter((_, k) => k !== i)]);
  const removeImg = (i: number) => set("images", f.images.filter((_, k) => k !== i));

  async function save() {
    setSaving(true); setErr("");
    if (!f) return;
    const body = { ...f, price: Number(f.price), variants: f.variants.filter((v) => v.name.trim()) };
    try {
      if (isNew) await api("/api/admin/products", { method: "POST", body: JSON.stringify(body) });
      else await api(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(body) });
      router.push("/admin/products");
    } catch (e) { setErr((e as Error).message); setSaving(false); }
  }

  async function remove() {
    if (!confirm("متأكد تحب تحذف هاد المنتج نهائياً؟ (تقدر غير تخبيه)")) return;
    try { await api(`/api/admin/products/${id}`, { method: "DELETE" }); router.push("/admin/products"); }
    catch (e) { setErr((e as Error).message); }
  }

  const input = "w-full rounded-xl border border-line bg-white px-4 py-3 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15";
  const label = "mb-1.5 block text-sm font-bold text-navy";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/products" className="rounded-xl bg-white px-3 py-2 font-bold ring-1 ring-line">→</Link>
        <h1 className="text-xl font-extrabold text-navy">{isNew ? "➕ منتج جديد" : "✏️ تعديل المنتج"}</h1>
      </div>

      <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-line">
        <div><label className={label}>اسم المنتج *</label><input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="مثال: كاميرا WiFi بعدستين 360°" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>السعر (دج) *</label><input className={input} inputMode="numeric" value={f.price} onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))} /></div>
          <div><label className={label}>السعر القديم (مشطوب)</label><input className={input} inputMode="numeric" value={f.compareAtPrice} onChange={(e) => set("compareAtPrice", e.target.value.replace(/\D/g, ""))} placeholder="اختياري" /></div>
        </div>
        <div><label className={label}>القسم</label>
          <select className={input} value={f.category} onChange={(e) => set("category", e.target.value)}>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-3 rounded-xl bg-soft p-3 font-bold">
          <input type="checkbox" className="size-5" checked={f.active} onChange={(e) => set("active", e.target.checked)} />
          يبان فالمتجر
        </label>
      </section>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <label className={label}>الصور <span className="font-normal text-muted">(الأولى هي الرئيسية)</span></label>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
          {f.images.map((src, i) => (
            <div key={src} className={`relative aspect-square overflow-hidden rounded-xl ring-2 ${i === 0 ? "ring-brand" : "ring-line"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 p-1">
                {i > 0 ? <button type="button" onClick={() => moveFirst(i)} className="rounded bg-white/90 px-1.5 text-xs font-bold">⭐ رئيسية</button> : <span className="px-1 text-xs font-bold text-white">⭐</span>}
                <button type="button" onClick={() => removeImg(i)} className="rounded bg-sale px-1.5 text-xs font-bold text-white">✕</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading > 0}
            className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-line text-center text-sm font-bold text-muted">
            {uploading > 0 ? `⏳ ${uploading}...` : "📷\nزيد صور"}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      </section>

      <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-line">
        <div><label className={label}>جملة قصيرة فوق الاسم</label><input className={input} value={f.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="مثال: احمي رزقك وين ما كنت 🔒" /></div>
        <div>
          <label className={label}>الوصف <span className="font-normal text-muted">(كل سطر يبان وحدو)</span></label>
          <textarea className={`${input} min-h-48 leading-7`} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder={"✅ رؤية ليلية\n✅ تخدم بالـ WiFi\n✅ تنبيه على التيليفون"} />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
        <label className={label}>الأنواع / الألوان <span className="font-normal text-muted">(اختياري — كل نوع بسعرو)</span></label>
        {f.variants.map((v, i) => (
          <div key={i} className="flex gap-2">
            <input className={input} placeholder="الاسم (مثلا: أبيض)" value={v.name} onChange={(e) => set("variants", f.variants.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
            <input className={`${input} w-32`} inputMode="numeric" placeholder="السعر" value={v.price} onChange={(e) => set("variants", f.variants.map((x, k) => (k === i ? { ...x, price: e.target.value.replace(/\D/g, "") } : x)))} />
            <button type="button" onClick={() => set("variants", f.variants.filter((_, k) => k !== i))} className="rounded-xl bg-sale/10 px-3 font-bold text-sale">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => set("variants", [...f.variants, { name: "", price: f.price }])} className="rounded-xl bg-soft px-4 py-2 text-sm font-bold text-navy">➕ زيد نوع</button>
      </section>

      <details className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <summary className="cursor-pointer font-bold text-muted">إعدادات متقدمة</summary>
        <div className="mt-3"><label className={label}>رابط المنتج (بالإنجليزية)</label>
          <input className={input} dir="ltr" value={f.slug} onChange={(e) => set("slug", e.target.value)} placeholder="يتعمر وحدو" />
          <p className="mt-1 text-xs text-muted" dir="ltr">/products/{f.slug || "..."}</p>
        </div>
      </details>

      {!isNew && <button type="button" onClick={remove} className="w-full rounded-xl py-3 font-bold text-sale ring-1 ring-sale/30">🗑️ حذف المنتج</button>}

      <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-white/95 p-3 backdrop-blur md:-mx-6">
        <div>
          {err && <p className="mb-2 rounded-xl bg-sale/10 p-2 text-sm font-semibold text-sale">{err}</p>}
          <button onClick={save} disabled={saving || uploading > 0} className="w-full rounded-xl bg-brand py-3.5 text-lg font-extrabold text-white disabled:opacity-50">
            {saving ? "جاري الحفظ..." : "💾 حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}
