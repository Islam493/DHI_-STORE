"use client";
import { useState } from "react";
import Logo from "@/components/Logo";

export default function Login() {
  const [pw, setPw] = useState("");
  const [user, setUser] = useState("admin");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: user.trim(), password: pw }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { window.location.href = "/admin"; return; }
    setErr(d.error || "صرا مشكل");
    setBusy(false);
  }
  const input = "w-full rounded-xl border border-line px-4 py-3 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15";
  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-sm ring-1 ring-line">
        <div className="mb-6 text-center"><Logo /><p className="mt-3 font-bold text-navy">لوحة التحكم</p></div>

        <label className="mb-2 block text-sm font-bold">اسم المستخدم</label>
        <input autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} dir="ltr" value={user} onChange={(e) => setUser(e.target.value)} className={`${input} mb-1`} />
        <p className="mb-4 text-xs text-muted">👑 المدير: <b dir="ltr">admin</b> · 🧑‍💻 الموظف: الاسم اللي عطاهولو المدير</p>

        <label className="mb-2 block text-sm font-bold">كلمة السر</label>
        <div className="relative">
          <input type={show ? "text" : "password"} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} className={`${input} pl-12`} />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "خبّي كلمة السر" : "بيّن كلمة السر"} className="absolute inset-y-0 left-0 grid w-12 place-items-center text-lg">{show ? "🙈" : "👁️"}</button>
        </div>
        <p className="mt-1 text-xs text-muted">👑 المدير: كلمة السر اللي حطيتها فـ Vercel (ADMIN_PASSWORD)</p>

        {err && <p className="mt-3 rounded-xl bg-sale/10 p-3 text-sm font-semibold text-sale">{err}</p>}
        <button disabled={busy || !pw} className="mt-4 w-full rounded-xl bg-brand py-3 font-extrabold text-white disabled:opacity-50">{busy ? "..." : "دخول"}</button>
      </form>
    </div>
  );
}
