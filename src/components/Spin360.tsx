"use client";
import { useEffect, useRef, useState } from "react";

// عرض 360°: صور حقيقية للمنتج من كل جيهة، الزبون يحرّك بصبعو ولا بالفأرة باش يدوّرو
export default function Spin360({ frames, alt, reverse = false }: { frames: string[]; alt: string; reverse?: boolean }) {
  const n = frames.length;
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; i: number } | null>(null);
  const [i, setI] = useState(0);
  const [loaded, setLoaded] = useState(1);
  const [armed, setArmed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [touched, setTouched] = useState(false);
  const [holding, setHolding] = useState(false);
  const ready = loaded >= n;

  // نحمّلو الصور غير كي يقرب الزبون منها
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      setVisible(e.isIntersecting);
      if (e.isIntersecting) setArmed(true);
    }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [frames]);

  // تدور وحدها بالشوية حتى يمسّها الزبون
  useEffect(() => {
    if (!ready || touched || !visible || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 110);
    return () => clearInterval(t);
  }, [ready, touched, visible, n]);

  const bump = () => setLoaded((x) => x + 1);
  const go = (k: number) => setI(((k % n) + n) % n);
  const sign = reverse ? -1 : 1;

  function down(e: React.PointerEvent) {
    setTouched(true); setHolding(true);
    drag.current = { x: e.clientX, i };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drag.current || !box.current) return;
    const perFrame = box.current.clientWidth / n; // عرض الشاشة كامل = دورة كاملة
    go(drag.current.i - sign * Math.round((e.clientX - drag.current.x) / perFrame));
  }
  function up() { drag.current = null; setHolding(false); }

  return (
    <div ref={box} role="slider" tabIndex={0} aria-label={`${alt}: دوّرها 360°`} aria-valuemin={1} aria-valuemax={n} aria-valuenow={i + 1}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onKeyDown={(e) => { if (e.key === "ArrowLeft") { setTouched(true); go(i + sign); } if (e.key === "ArrowRight") { setTouched(true); go(i - sign); } }}
      className={`absolute inset-0 touch-pan-y select-none outline-none ${holding ? "cursor-grabbing" : "cursor-grab"}`}>
      {/* كل الصور فوق بعضاهم، نبيّنو غير وحدة: التبديل يكون فوري بلا ما يرمش */}
      {frames.map((src, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={k === 0 || armed ? src : undefined} alt={k === 0 ? alt : ""} draggable={false}
          onLoad={k ? bump : undefined} onError={k ? bump : undefined}
          className={`pointer-events-none absolute inset-0 size-full object-contain ${k === i ? "opacity-100" : "opacity-0"}`} />
      ))}
      <span className="absolute left-3 top-3 rounded-full bg-navy/85 px-3 py-1 text-xs font-extrabold text-white">🔄 360°</span>
      {!ready && (
        <div className="absolute inset-x-6 bottom-5 h-1.5 overflow-hidden rounded-full bg-navy/10">
          <div className="h-full bg-brand transition-all" style={{ width: `${Math.round((loaded / n) * 100)}%` }} />
        </div>
      )}
      {ready && !touched && (
        <span className="pointer-events-none absolute inset-x-0 bottom-4 mx-auto flex w-max items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-extrabold text-navy shadow-lg ring-1 ring-line">
          <span className="spin-hand">👆</span> حرّك يمين ولا يسار باش تدوّرها
        </span>
      )}
    </div>
  );
}
