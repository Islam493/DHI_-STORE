"use client";
import { useEffect, useRef, useState } from "react";
import { statuses, type Status } from "@/lib/order-types";

// زر الحالة: كي تضغط عليه تخرج لستة كل الحالات
export default function StatusPicker({ value, onPick, disabled }: { value: string; onPick: (s: Status) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const st = statuses[value as Status] || statuses.new;
  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" disabled={disabled} onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${st.color} disabled:opacity-50`}>
        <span>{st.icon}</span>{st.label}<span className="opacity-60">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-60 overflow-hidden rounded-2xl bg-white py-1 shadow-xl ring-1 ring-line">
          {(Object.keys(statuses) as Status[]).map((s) => (
            <button key={s} type="button" onClick={() => { setOpen(false); if (s !== value) onPick(s); }}
              className={`flex w-full items-center gap-2 px-4 py-2 text-right text-sm hover:bg-soft ${s === value ? "bg-soft font-extrabold text-navy" : "text-ink"}`}>
              <span className="w-5 text-center">{statuses[s].icon}</span>{statuses[s].label}{s === value && <span className="mr-auto text-brand">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
