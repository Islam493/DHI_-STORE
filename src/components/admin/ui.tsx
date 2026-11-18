"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { Perm, Role } from "@/lib/perms";

// ---------- المستخدم الحالي والصلاحيات ----------
export type Me = { name: string; role: Role; owner: boolean; perms: Perm[] };
const MeCtx = createContext<Me | null>(null);
export const useMe = () => useContext(MeCtx);
export const useCan = () => { const me = useMe(); return (p: Perm) => !!me?.perms.includes(p); };

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    fetch("/api/admin/me").then(async (r) => {
      if (r.status === 401) { window.location.href = "/admin/login"; return; }
      setMe(await r.json());
    }).catch(() => {});
  }, []);
  return <MeCtx.Provider value={me}>{children}</MeCtx.Provider>;
}

// ---------- الرسائل (نجح / غلطة) ----------
type T = { id: number; text: string; ok: boolean };
let pushToast: (t: Omit<T, "id">) => void = () => {};
export const toast = (text: string, ok = true) => pushToast({ text, ok });

export function Toaster() {
  const [list, setList] = useState<T[]>([]);
  useEffect(() => {
    pushToast = (t) => {
      const id = Date.now() + Math.random();
      setList((l) => [...l, { ...t, id }]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 3500);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} role="status" className={`pointer-events-auto rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-xl ${t.ok ? "bg-navy" : "bg-sale"}`}>{t.ok ? "✅ " : "⚠️ "}{t.text}</div>
      ))}
    </div>
  );
}

// ---------- نافذة التأكيد ----------
type C = { text: string; danger?: boolean; resolve: (v: boolean) => void };
let openConfirm: (c: C) => void = () => {};
export const confirmAction = (text: string, danger = true) => new Promise<boolean>((resolve) => openConfirm({ text, danger, resolve }));

export function ConfirmHost() {
  const [c, setC] = useState<C | null>(null);
  useEffect(() => { openConfirm = setC; }, []);
  if (!c) return null;
  const done = (v: boolean) => { c.resolve(v); setC(null); };
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" onClick={() => done(false)}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <p className="text-3xl">{c.danger ? "⚠️" : "❓"}</p>
        <p className="mt-3 font-bold leading-7 text-navy">{c.text}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button autoFocus onClick={() => done(true)} className={`rounded-xl py-3 font-extrabold text-white ${c.danger ? "bg-sale" : "bg-brand"}`}>نعم، أكّد</button>
          <button onClick={() => done(false)} className="rounded-xl bg-soft py-3 font-bold">لا، رجوع</button>
        </div>
      </div>
    </div>
  );
}

// ---------- هياكل التحميل ----------
export function Skeleton({ rows = 5, className = "h-14" }: { rows?: number; className?: string }) {
  return <div className="space-y-2">{Array.from({ length: rows }, (_, i) => <div key={i} className={`animate-pulse rounded-2xl bg-white ring-1 ring-line ${className}`} />)}</div>;
}

export function Empty({ icon = "📭", text, children }: { icon?: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-line">
      <p className="text-4xl">{icon}</p>
      <p className="mt-2 font-bold text-muted">{text}</p>
      {children}
    </div>
  );
}

export function NoAccess() {
  return <Empty icon="🔒" text="ما عندكش الصلاحية تشوف هاد الصفحة. اطلب من المدير." />;
}
