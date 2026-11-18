"use client";
import { useEffect, useRef, useState } from "react";
import { IconWhatsapp } from "./SocialIcons";

// زر الواتساب العايم: يفتح قائمة فيها الرقمين
export default function WhatsAppMenu({ items }: { items: { label: string; n: string; href: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const one = items.length === 1;
  return (
    <div ref={ref} className="fixed bottom-24 left-4 z-40 md:bottom-6">
      {open && !one && (
        <div className="mb-3 w-64 overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-line">
          <div className="bg-wa px-4 py-3 text-white"><p className="font-extrabold">💬 فريق DHI Electronics</p><p className="text-xs opacity-90">اختار رقم وراسلنا مباشرة</p></div>
          {items.map((it) => (
            <a key={it.n} href={it.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-soft">
              <span className="grid size-10 place-items-center rounded-full bg-wa/10 text-wa"><IconWhatsapp className="size-5" /></span>
              <span><span className="block text-sm font-bold text-navy">{it.label}</span><span className="text-xs text-muted" dir="ltr">{it.n}</span></span>
            </a>
          ))}
        </div>
      )}
      {one ? (
        <a href={items[0].href} target="_blank" rel="noopener noreferrer" aria-label="راسلنا على واتساب" className="grid size-14 place-items-center rounded-full bg-wa text-white shadow-lg shadow-wa/40"><IconWhatsapp className="size-7" /></a>
      ) : (
        <button onClick={() => setOpen(!open)} aria-label="راسلنا على واتساب" aria-expanded={open}
          className="grid size-14 place-items-center rounded-full bg-wa text-white shadow-lg shadow-wa/40 transition hover:scale-105">
          {open ? <span className="text-2xl font-bold">✕</span> : <IconWhatsapp className="size-7" />}
        </button>
      )}
    </div>
  );
}
