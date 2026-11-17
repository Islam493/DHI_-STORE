"use client";
import Image from "next/image";
import { useState } from "react";

export default function Gallery({ images, alt, badge }: { images: string[]; alt: string; badge?: number }) {
  const [i, setI] = useState(0);
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-soft">
        <Image src={images[i]} alt={alt} fill priority sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
        {badge ? <span className="absolute right-3 top-3 rounded-full bg-sale px-3 py-1 text-sm font-bold text-white"><bdi dir="ltr">-{badge}%</bdi></span> : null}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((src, k) => (
            <button key={src} onClick={() => setI(k)} aria-label={`صورة ${k + 1}`}
              className={`relative size-16 shrink-0 overflow-hidden rounded-xl border-2 ${k === i ? "border-brand" : "border-line"}`}>
              <Image src={src} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
