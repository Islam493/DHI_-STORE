"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

// videos[k] = فيديو الموشن تاع الصورة k (ولا فارغ). الصورة تبان الأولى، والفيديو يبدا فوقها
export default function Gallery({ images, videos = [], alt, badge }: { images: string[]; videos?: string[]; alt: string; badge?: number }) {
  const [i, setI] = useState(0);
  const [motion, setMotion] = useState(false);
  useEffect(() => setMotion(!window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  const vid = motion ? videos[i] : "";
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-soft">
        <Image src={images[i]} alt={alt} fill priority sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
        {vid && <video key={vid} src={vid} autoPlay muted loop playsInline preload="auto" aria-hidden className="absolute inset-0 size-full object-cover" />}
        {/* التصاميم فيهم اللوغو والتخفيض، ما نغطيوهمش */}
        {badge && !videos[i] ? <span className="absolute right-3 top-3 rounded-full bg-sale px-3 py-1 text-sm font-bold text-white"><bdi dir="ltr">-{badge}%</bdi></span> : null}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {images.map((src, k) => (
            <button key={src} onClick={() => setI(k)} aria-label={`صورة ${k + 1}`}
              className={`relative size-16 shrink-0 overflow-hidden rounded-xl border-2 ${k === i ? "border-brand" : "border-line"}`}>
              <Image src={src} alt="" fill sizes="64px" className="object-cover" />
              {videos[k] && <span className="absolute bottom-0.5 left-0.5 grid size-5 place-items-center rounded-full bg-navy/80 text-[9px] text-white">▶</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
