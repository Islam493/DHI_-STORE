"use client";
import Image from "next/image";
import { useMemo, useState } from "react";
import { summarize, type Review } from "@/lib/review-types";

export function Stars({ value, size = "text-base" }: { value: number; size?: string }) {
  return (
    <span className={`inline-flex ${size}`} dir="ltr" aria-label={`${value} من 5`}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= Math.round(value) ? "text-amber-400" : "text-gray-300"}>★</span>)}
    </span>
  );
}

// قسم الآراء: ملخص + فلترة بالنجوم + ترتيب. إذا ما كانش آراء: رسالة صادقة
export default function Reviews({ reviews, title = "آراء الزبائن" }: { reviews: Review[]; title?: string }) {
  const [stars, setStars] = useState(0);
  const [sort, setSort] = useState<"new" | "high" | "photo">("new");
  const [n, setN] = useState(6);
  const s = useMemo(() => summarize(reviews), [reviews]);
  const shown = useMemo(() => {
    let l = stars ? reviews.filter((r) => r.rating === stars) : reviews;
    if (sort === "high") l = [...l].sort((a, b) => b.rating - a.rating);
    if (sort === "photo") l = [...l].sort((a, b) => Number(!!b.image) - Number(!!a.image));
    return l;
  }, [reviews, stars, sort]);

  return (
    <section id="reviews" className="scroll-mt-28">
      <h2 className="mb-4 text-2xl font-extrabold text-navy">⭐ {title}</h2>
      {reviews.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-soft p-8 text-center text-muted">مازال ما كانش آراء منشورة على هاد المنتج. كي تجرّبو، شاركنا رأيك على الواتساب 💬</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <div className="h-fit rounded-3xl bg-white p-5 ring-1 ring-line">
            <p className="text-5xl font-extrabold text-navy">{s.avg.toFixed(1)}</p>
            <Stars value={s.avg} size="text-xl" />
            <p className="mt-1 text-sm text-muted">{s.count} رأي</p>
            <div className="mt-4 space-y-1.5">
              {s.by.map((b) => (
                <button key={b.stars} onClick={() => setStars(stars === b.stars ? 0 : b.stars)} className={`flex w-full items-center gap-2 rounded-lg px-1 text-xs ${stars === b.stars ? "bg-brand/10" : ""}`}>
                  <span className="w-6 font-bold">{b.stars}★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-soft"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${s.count ? (b.count / s.count) * 100 : 0}%` }} /></span>
                  <span className="w-6 text-muted">{b.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              {stars > 0 && <button onClick={() => setStars(0)} className="rounded-full bg-navy px-3 py-1.5 font-bold text-white">{stars}★ ✕</button>}
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-full border border-line bg-white px-3 py-1.5 font-bold">
                <option value="new">الأحدث</option><option value="high">الأعلى تقييما</option><option value="photo">بالصور أولا</option>
              </select>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {shown.slice(0, n).map((r) => (
                <li key={r.id} className="rounded-2xl bg-white p-4 ring-1 ring-line">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-extrabold text-navy">{r.name}{r.wilaya && <span className="text-xs font-normal text-muted"> · {r.wilaya}</span>}</p>
                      <Stars value={r.rating} size="text-sm" />
                    </div>
                    {r.verified && <span className="shrink-0 rounded-full bg-ok/10 px-2 py-0.5 text-[11px] font-bold text-ok">✓ شراء مؤكد</span>}
                  </div>
                  {r.text && <p className="mt-2 text-sm leading-7">{r.text}</p>}
                  {r.image && <div className="relative mt-2 h-48 overflow-hidden rounded-xl bg-soft"><Image src={r.image} alt={`رأي ${r.name}`} fill sizes="(max-width:640px) 100vw, 33vw" className="object-contain" /></div>}
                </li>
              ))}
            </ul>
            {shown.length > n && <button onClick={() => setN(n + 6)} className="mt-3 w-full rounded-xl bg-white py-3 text-sm font-bold text-brand ring-1 ring-line">شوف آراء أخرى ({shown.length - n})</button>}
          </div>
        </div>
      )}
    </section>
  );
}
