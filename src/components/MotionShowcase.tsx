"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Benefit = { icon: string; title: string; text: string };
const STEP = 2800;
const spots = ["top-[8%] -right-2 md:-right-6", "top-[38%] -left-3 md:-left-8", "bottom-[22%] -right-3 md:-right-8", "bottom-[4%] left-[8%]"];

// موشن جرافيك: صورة المنتج الحقيقية + المميزات يبانو واحد بواحد حسب الكلام
export default function MotionShowcase({ image, name, headline, benefits, scan = false }: { image: string; name: string; headline: string; benefits: Benefit[]; scan?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [i, setI] = useState(0);
  const list = benefits.slice(0, 6);

  // يخدم غير كي يبان فالشاشة (باش ما ياكلش البطارية)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || list.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % list.length), STEP);
    return () => clearInterval(t);
  }, [visible, list.length]);

  if (!list.length) return null;
  const cur = list[i];

  return (
    <section ref={ref} className={`relative overflow-hidden bg-navy py-14 text-white ${visible ? "" : "m-paused"}`} aria-label={`مميزات ${name}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_60%_at_80%_30%,rgba(47,128,237,.35),transparent_65%)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-2">
        {/* المسرح: الصورة + المميزات حواليها */}
        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-6 rounded-full bg-brand/20 blur-3xl" />
          <div className="relative aspect-square overflow-hidden rounded-[2.5rem] bg-white shadow-2xl ring-8 ring-white/5">
            <Image src={image} alt={name} fill sizes="(max-width:768px) 90vw, 450px" className="m-kenburns object-cover" />
            {scan && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden mix-blend-multiply">
                <div className="m-sweep absolute -inset-1/2 bg-[conic-gradient(from_0deg,transparent_0deg,rgba(47,128,237,.28)_40deg,transparent_70deg)]" />
              </div>
            )}
            {scan && <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white"><span className="relative flex size-2"><span className="m-ping absolute inset-0 rounded-full bg-red-500" /><span className="relative size-2 rounded-full bg-red-500" /></span>LIVE</span>}
          </div>
          {list.slice(0, 4).map((b, k) => (
            <div key={b.title} className={`absolute ${spots[k]} ${visible ? "m-chip" : "opacity-0"}`} style={{ animationDelay: `${0.25 + k * 0.35}s` }}>
              <div className={`m-float flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-extrabold shadow-xl transition-all duration-500 md:text-sm ${list.indexOf(cur) === k ? "scale-110 bg-brand text-white ring-4 ring-brand/30" : "bg-white text-navy"}`} style={{ animationDelay: `${k * 0.6}s` }}>
                <span className="text-lg">{b.icon}</span>{b.title}
              </div>
            </div>
          ))}
        </div>

        {/* الكلام: يتبدل مع كل ميزة */}
        <div>
          <p className="text-sm font-extrabold text-brand">✨ {name}</p>
          <h2 className="mt-2 text-2xl font-extrabold leading-snug md:text-4xl">{headline}</h2>
          <div key={i} className="m-fadeup mt-6 rounded-3xl bg-white/10 p-5 ring-1 ring-white/15" aria-live="polite">
            <p className="text-4xl">{cur.icon}</p>
            <p className="mt-2 text-xl font-extrabold">{cur.title}</p>
            <p className="mt-1 leading-7 text-white/75">{cur.text}</p>
          </div>
          {list.length > 1 && (
            <div className="mt-5 flex gap-1.5" dir="ltr">
              {list.map((b, k) => (
                <button key={b.title} onClick={() => setI(k)} aria-label={b.title} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                  {k < i && <span className="block h-full w-full bg-brand" />}
                  {k === i && <span key={`f${i}`} className="m-fill block h-full w-full origin-left bg-brand" style={{ ["--d" as string]: `${STEP}ms` }} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
