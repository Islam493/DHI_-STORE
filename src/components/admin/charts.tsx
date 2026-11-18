"use client";
import { useState } from "react";

// رسوم بيانية خفيفة (SVG بلا مكتبات)
export type Series = { key: string; label: string; color: string };

export function Bars({ data, series, height = 180, fmt = (n: number) => n.toLocaleString("en-US") }: {
  data: (Record<string, number | string> & { day: string })[]; series: Series[]; height?: number; fmt?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(...series.map((s) => Number(d[s.key]) || 0))));
  const label = (d: string) => d.slice(5).replace("-", "/");
  return (
    <div className="min-w-0">
      <div className="relative flex items-end gap-0.5 sm:gap-1" style={{ height }} dir="ltr">
        {data.map((d, i) => (
          <div key={d.day} className="relative flex h-full min-w-0 flex-1 items-end justify-center gap-px" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {series.map((s) => (
              <div key={s.key} className="w-full max-w-4 rounded-t transition-all" style={{ height: `${((Number(d[s.key]) || 0) / max) * 100}%`, background: s.color, opacity: hover === null || hover === i ? 1 : 0.45 }} />
            ))}
            {hover === i && (
              <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg bg-navy px-2.5 py-1.5 text-[11px] font-bold text-white shadow-lg" dir="rtl">
                <p className="opacity-70">{d.day}</p>
                {series.map((s) => <p key={s.key}><span className="ml-1 inline-block size-2 rounded-full" style={{ background: s.color }} />{s.label}: {fmt(Number(d[s.key]) || 0)}</p>)}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5 text-[9px] text-muted sm:gap-1" dir="ltr">
        {data.map((d, i) => <span key={d.day} className="min-w-0 flex-1 overflow-hidden text-center">{data.length <= 14 || i % Math.ceil(data.length / 10) === 0 ? label(d.day) : ""}</span>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        {series.map((s) => <span key={s.key} className="flex items-center gap-1"><i className="size-3 rounded" style={{ background: s.color }} />{s.label}</span>)}
      </div>
    </div>
  );
}

export function Meter({ label, value, good = true }: { label: string; value: number | null; good?: boolean }) {
  const v = value ?? 0;
  const color = value === null ? "#cbd5e1" : good ? (v >= 70 ? "#12a150" : v >= 50 ? "#f59e0b" : "#e5484d") : (v <= 10 ? "#12a150" : v <= 25 ? "#f59e0b" : "#e5484d");
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-navy">{value === null ? "—" : `${v}%`}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full" style={{ width: `${Math.min(100, v)}%`, background: color }} /></div>
    </div>
  );
}
