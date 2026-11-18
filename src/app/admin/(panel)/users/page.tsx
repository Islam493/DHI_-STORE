"use client";
import { useEffect, useState } from "react";
import { api, timeAgo } from "@/components/admin/api";
import { Empty, NoAccess, Skeleton, confirmAction, toast, useCan, useMe } from "@/components/admin/ui";
import { roleLabel, type Role } from "@/lib/perms";

type U = { id: string; created_at: string; name: string; username: string; role: Role; active: boolean };
const empty = { name: "", username: "", password: "", role: "staff" as Role };

export default function Users() {
  const can = useCan();
  const me = useMe();
  const [list, setList] = useState<U[] | null>(null);
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = () => api<{ users: U[] }>("/api/admin/users").then((d) => setList(d.users)).catch((e) => setErr(e.message));
  useEffect(() => { if (me && can("users.manage")) load(); }, [me]); // eslint-disable-line react-hooks/exhaustive-deps
  if (me && !can("users.manage")) return <NoAccess />;

  async function add() {
    setBusy(true);
    try { await api("/api/admin/users", { method: "POST", body: JSON.stringify(f) }); toast(`تزاد ${f.name}`); setF(empty); load(); }
    catch (e) { toast((e as Error).message, false); }
    setBusy(false);
  }
  async function patch(u: U, body: Record<string, unknown>, msg: string) {
    try { await api("/api/admin/users", { method: "PATCH", body: JSON.stringify({ id: u.id, ...body }) }); toast(msg); load(); }
    catch (e) { toast((e as Error).message, false); }
  }
  async function resetPw(u: U) {
    const pw = prompt(`كلمة سر جديدة لـ ${u.name} (8 حروف ولا أكثر):`);
    if (pw) patch(u, { password: pw }, "تبدلت كلمة السر");
  }

  const input = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base outline-none focus:border-brand";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-navy">🧑‍💼 الفريق</h1>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 text-sm ring-1 ring-line"><p className="font-extrabold text-navy">👑 مدير</p><p className="mt-1 leading-6 text-muted">كلشي: الطلبيات، المنتجات، المخزون، الإحصائيات والمداخيل، الإعدادات، الفريق، سجل النشاط، التصدير والحذف.</p></div>
        <div className="rounded-2xl bg-white p-4 text-sm ring-1 ring-line"><p className="font-extrabold text-navy">🧑‍💻 موظف</p><p className="mt-1 leading-6 text-muted">الطلبيات (يشوف، يأكد، يبدّل الحالة، يبعث للتوصيل)، الزبائن، الآراء. ما يشوفش المداخيل ولا الإعدادات، وما يقدرش يحذف ولا يصدّر.</p></div>
      </div>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
        <h2 className="font-extrabold text-navy">➕ زيد عضو للفريق</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-bold">الاسم<input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="مثلا: سارة" /></label>
          <label className="text-sm font-bold">اسم المستخدم<input className={input} dir="ltr" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "") })} placeholder="sara" /></label>
          <label className="text-sm font-bold">كلمة السر<input className={input} dir="ltr" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="8 حروف ولا أكثر" /></label>
          <label className="text-sm font-bold">الدور
            <select className={input} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}><option value="staff">🧑‍💻 موظف</option><option value="admin">👑 مدير</option></select>
          </label>
        </div>
        <button onClick={add} disabled={busy} className="rounded-xl bg-brand px-6 py-3 font-extrabold text-white disabled:opacity-50">{busy ? "..." : "➕ زيد"}</button>
        <p className="text-xs text-muted">💡 الموظف يدخل لـ <b dir="ltr">/admin</b> باسم المستخدم وكلمة السر تاعو. انت تدخل بـ <b dir="ltr">admin</b> وكلمة السر الرئيسية.</p>
      </section>

      {err ? <p className="rounded-2xl bg-sale/10 p-4 text-sale">{err}</p> : !list ? <Skeleton rows={3} /> : list.length === 0 ? <Empty icon="🧑‍💼" text="مازال ما زدت حتى عضو" /> : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line">
          {list.map((u) => (
            <li key={u.id} className={`flex flex-wrap items-center gap-3 p-4 ${u.active ? "" : "opacity-50"}`}>
              <span className="grid size-11 place-items-center rounded-full bg-brand/10 font-extrabold text-brand">{u.name.slice(0, 1)}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-navy">{u.name} <span className="rounded-full bg-soft px-2 py-0.5 text-[11px]">{roleLabel[u.role]}</span> {!u.active && <span className="text-xs text-sale">(معطّل)</span>}</p>
                <p className="text-xs text-muted"><span dir="ltr">@{u.username}</span> · تزاد {timeAgo(u.created_at)}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                <button onClick={() => resetPw(u)} className="rounded-lg bg-soft px-3 py-1.5">🔑 كلمة سر</button>
                <button onClick={() => patch(u, { role: u.role === "admin" ? "staff" : "admin" }, "تبدّل الدور")} className="rounded-lg bg-soft px-3 py-1.5">↔️ {u.role === "admin" ? "رجّعو موظف" : "ردّو مدير"}</button>
                <button onClick={async () => { if (!u.active || (await confirmAction(`تعطّل ${u.name}؟ ما يقدرش يدخل للوحة.`))) patch(u, { active: !u.active }, u.active ? "تعطّل" : "تفعّل"); }} className={`rounded-lg px-3 py-1.5 ${u.active ? "text-sale ring-1 ring-sale/30" : "bg-ok/10 text-ok"}`}>{u.active ? "⛔ عطّل" : "✅ فعّل"}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
