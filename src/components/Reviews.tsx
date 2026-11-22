"use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { isShot, summarize, type Review } from "@/lib/review-types";

export function Stars({ value, size = "text-base" }: { value: number; size?: string }) {
  return (
    <span className={`inline-flex ${size}`} dir="ltr" aria-label={`${value} من 5`}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= Math.round(value) ? "text-amber-400" : "text-gray-300"}>★</span>)}
    </span>
  );
}

const COLORS = ["bg-brand", "bg-navy", "bg-[#0e9f6e]", "bg-[#7c3aed]", "bg-[#db2777]", "bg-[#ea580c]", "bg-[#0891b2]"];
const color = (s: string) => COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
function ago(iso: string) {
  const d = Math.max(0, (Date.now() - new Date(iso).getTime()) / 86400000);
  if (d < 1) return "اليوم";
  if (d < 2) return "البارح";
  if (d < 7) return `قبل ${Math.floor(d)} أيام`;
  if (d < 30) return `قبل ${Math.floor(d / 7)} أسابيع`;
  if (d < 365) return `قبل ${Math.floor(d / 30)} شهور`;
  return `قبل ${Math.floor(d / 365)} سنة`;
}

// قسم الآراء: ملخص النجوم + معرض سكرينات رسائل الزبائن + كروت الآراء. ما كانش آراء: ما يبانش
export default function Reviews({ reviews, title = "آراء الزبائن" }: { reviews: Review[]; title?: string }) {
  const [stars, setStars] = useState(0);
  const [n, setN] = useState(6);
  const [open, setOpen] = useState<number | null>(null);
  const shots = useMemo(() => reviews.filter(isShot), [reviews]);
  const written = useMemo(() => reviews.filter((r) => !isShot(r)), [reviews]);
  const s = useMemo(() => summarize(written), [written]);
  const shown = useMemo(() => {
    const l = stars ? written.filter((r) => r.rating === stars) : written;
    return [...l].sort((a, b) => Number(!!b.image) - Number(!!a.image) || +new Date(b.created_at) - +new Date(a.created_at));
  }, [written, stars]);

  useEffect(() => {
    if (open === null) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i + 1) % shots.length));
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i - 1 + shots.length) % shots.length));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, shots.length]);

  if (!reviews.length) return null;

  return (
    <section id="reviews" className="scroll-mt-28">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold text-brand">💬 زبائننا يهدرو</p>
          <h2 className="text-2xl font-extrabold text-navy md:text-3xl">{title}</h2>
        </div>
        <p className="rounded-full bg-ok/10 px-3 py-1.5 text-xs font-extrabold text-ok">✓ آراء حقيقية من زبائن DHI</p>
      </div>

      {written.length > 0 && (
        <div className="mb-6 grid gap-4 rounded-3xl bg-gradient-to-l from-navy to-[#173a6b] p-5 text-white md:grid-cols-[auto_1fr] md:items-center md:gap-8 md:p-6">
          <div className="text-center md:px-4">
            <p className="text-6xl font-extrabold leading-none">{s.avg.toFixed(1)}</p>
            <div className="mt-2"><Stars value={s.avg} size="text-2xl" /></div>
            <p className="mt-1 text-sm text-white/70">من {s.count} رأي</p>
          </div>
          <div className="space-y-1.5">
            {s.by.map((b) => (
              <button key={b.stars} onClick={() => setStars(stars === b.stars ? 0 : b.stars)} aria-pressed={stars === b.stars}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-1 text-sm transition ${stars === b.stars ? "bg-white/15" : "hover:bg-white/10"}`}>
                <span className="w-8 font-bold" dir="ltr">{b.stars} ★</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-amber-400 transition-all" style={{ width: `${s.count ? (b.count / s.count) * 100 : 0}%` }} /></span>
                <span className="w-8 text-left text-white/70">{b.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {shots.length > 0 && (
        <div className="mb-6">
          <p className="mb-3 font-extrabold text-navy">📸 من رسائل زبائننا <span className="text-sm font-bold text-muted">({shots.length})</span></p>
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {shots.map((r, i) => (
              <button key={r.id} onClick={() => setOpen(i)} aria-label={`رسالة زبون ${i + 1}`}
                className="group relative h-64 w-40 shrink-0 snap-start overflow-hidden rounded-2xl bg-soft shadow-sm ring-1 ring-line transition hover:-translate-y-1 hover:shadow-lg md:h-72 md:w-44">
                <Image src={r.image!} alt="" fill sizes="176px" className="object-cover object-top" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8 text-right text-[11px] font-bold text-white">{r.wilaya ? `📍 ${r.wilaya}` : "💬 رسالة زبون"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {written.length > 0 && (
        <>
          {stars > 0 && <button onClick={() => setStars(0)} className="mb-3 rounded-full bg-navy px-3 py-1.5 text-xs font-bold text-white">{stars}★ برك ✕</button>}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.slice(0, n).map((r) => (
              <li key={r.id} className="flex flex-col rounded-3xl bg-white p-5 shadow-sm ring-1 ring-line">
                <div className="flex items-center gap-3">
                  <span className={`grid size-11 shrink-0 place-items-center rounded-full text-lg font-extrabold text-white ${color(r.name)}`}>{r.name.trim()[0]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold text-navy">{r.name}</p>
                    <p className="text-xs text-muted">{r.wilaya ? `📍 ${r.wilaya} · ` : ""}{ago(r.created_at)}</p>
                  </div>
                  {r.verified && <span className="shrink-0 rounded-full bg-ok/10 px-2 py-1 text-[11px] font-extrabold text-ok">✓ شراء مؤكد</span>}
                </div>
                <div className="mt-3"><Stars value={r.rating} /></div>
                {r.text && <p className="mt-2 flex-1 leading-7 text-navy/90">«{r.text}»</p>}
                {r.image && <div className="relative mt-3 h-44 overflow-hidden rounded-2xl bg-soft"><Image src={r.image} alt={`صورة من ${r.name}`} fill sizes="(max-width:640px) 100vw, 33vw" className="object-cover" /></div>}
              </li>
            ))}
          </ul>
          {shown.length > n && <button onClick={() => setN(n + 6)} className="mt-4 w-full rounded-2xl bg-white py-3 font-bold text-brand ring-1 ring-line hover:bg-soft">شوف آراء أخرى ({shown.length - n})</button>}
        </>
      )}

      {open !== null && shots[open] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <button aria-label="سكّر" className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/15 text-2xl text-white">✕</button>
          {shots.length > 1 && <>
            <button aria-label="اللي قبل" onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + shots.length) % shots.length); }} className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-2xl text-white">›</button>
            <button aria-label="اللي بعد" onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % shots.length); }} className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-2xl text-white">‹</button>
          </>}
          <div className="relative h-[85vh] w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Image src={shots[open].image!} alt="" fill sizes="448px" className="object-contain" />
          </div>
          <p className="absolute bottom-4 text-sm font-bold text-white/80" dir="ltr">{open + 1} / {shots.length}</p>
        </div>
      )}
    </section>
  );
}
