"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import Spin360 from "./Spin360";

const SPIN = -1;

// videos[k] = فيديو الموشن تاع الصورة k (ولا فارغ). spin = صور 360° الحقيقية (الزبون يدوّر المنتج بيدو)
export default function Gallery({ images, videos = [], spin, alt, badge }: { images: string[]; videos?: string[]; spin?: { frames: string[]; reverse?: boolean }; alt: string; badge?: number }) {
  const [i, setI] = useState(0);
  const [motion, setMotion] = useState(false);
  useEffect(() => setMotion(!window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  const isSpin = i === SPIN && !!spin;
  const vid = motion && !isSpin ? videos[i] : "";

  const thumbs = images.map((src, k) => (
    <button key={src} onClick={() => setI(k)} aria-label={`صورة ${k + 1}`}
      className={`relative size-16 shrink-0 overflow-hidden rounded-xl border-2 ${k === i ? "border-brand" : "border-line"}`}>
      <Image src={src} alt="" fill sizes="64px" className="object-cover" />
      {videos[k] && <span className="absolute bottom-0.5 left-0.5 grid size-5 place-items-center rounded-full bg-navy/80 text-[9px] text-white">▶</span>}
    </button>
  ));
  if (spin) thumbs.splice(1, 0, (
    <button key="spin" onClick={() => setI(SPIN)} aria-label="شوفها 360°"
      className={`relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border-2 bg-soft ${isSpin ? "border-brand" : "border-line"}`}>
      <Image src={spin.frames[0]} alt="" fill sizes="64px" className="object-contain opacity-60" />
      <span className="relative text-[13px] font-extrabold text-navy">🔄<br />360°</span>
    </button>
  ));

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-soft">
        {isSpin ? <Spin360 frames={spin.frames} reverse={spin.reverse} alt={alt} /> : (
          <>
            <Image src={images[i]} alt={alt} fill priority sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
            {vid && <video key={vid} src={vid} autoPlay muted loop playsInline preload="auto" aria-hidden className="absolute inset-0 size-full object-cover" />}
            {/* التصاميم فيهم اللوغو والتخفيض، ما نغطيوهمش */}
            {badge && !videos[i] ? <span className="absolute right-3 top-3 rounded-full bg-sale px-3 py-1 text-sm font-bold text-white"><bdi dir="ltr">-{badge}%</bdi></span> : null}
            {spin && (
              <button onClick={() => setI(SPIN)} className="cta-nudge absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-navy/90 px-3.5 py-2 text-sm font-extrabold text-white shadow-lg backdrop-blur">
                🔄 دوّرها بيدك 360°
              </button>
            )}
          </>
        )}
      </div>
      {thumbs.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">{thumbs}</div>}
    </div>
  );
}
