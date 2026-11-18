import { NextResponse } from "next/server";
import { dbInsert, dbSelect, dbUpdate } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";
import { audit } from "@/lib/audit";
import { actor, fail, forgetUser, guard } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

type U = { id: string; created_at: string; name: string; username: string; role: string; active: boolean };

export async function GET() {
  const g = await guard("users.manage"); if (g) return g;
  try {
    const users = await dbSelect<U>("admin_users", { select: "id,created_at,name,username,role,active", order: ["created_at", "asc"] }, { fresh: true });
    return NextResponse.json({ users });
  } catch (e) { return fail(e); }
}

const clean = (b: Record<string, unknown>) => ({
  name: String(b.name || "").trim().slice(0, 60),
  username: String(b.username || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30),
  role: b.role === "admin" ? "admin" : "staff",
  password: typeof b.password === "string" ? b.password : "",
});

// زيادة موظف
export async function POST(req: Request) {
  const g = await guard("users.manage"); if (g) return g;
  const b = clean(await req.json().catch(() => ({})));
  if (b.name.length < 2) return NextResponse.json({ error: "اكتب الاسم" }, { status: 400 });
  if (b.username.length < 3 || b.username === "admin") return NextResponse.json({ error: "اسم المستخدم لازم 3 حروف ولا أكثر (بالإنجليزية) وماشي admin" }, { status: 400 });
  if (b.password.length < 8) return NextResponse.json({ error: "كلمة السر لازم 8 حروف ولا أكثر" }, { status: 400 });
  try {
    const exists = await dbSelect("admin_users", { eq: { username: b.username }, select: "id", limit: 1 }, { fresh: true });
    if (exists.length) return NextResponse.json({ error: "اسم المستخدم مستعمل" }, { status: 409 });
    const id = `u${Date.now().toString(36)}`;
    await dbInsert("admin_users", { id, created_at: new Date().toISOString(), name: b.name, username: b.username, role: b.role, active: true, password_hash: await hashPassword(b.password) });
    await audit(await actor(), "user.create", b.username, { role: b.role });
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}

// تعديل: تفعيل/تعطيل، الدور، كلمة سر جديدة
export async function PATCH(req: Request) {
  const g = await guard("users.manage"); if (g) return g;
  const b = await req.json().catch(() => ({}));
  if (typeof b.id !== "string") return NextResponse.json({ error: "معلومات غالطة" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (typeof b.active === "boolean") patch.active = b.active;
  if (b.role === "admin" || b.role === "staff") patch.role = b.role;
  if (typeof b.password === "string" && b.password) {
    if (b.password.length < 8) return NextResponse.json({ error: "كلمة السر لازم 8 حروف ولا أكثر" }, { status: 400 });
    patch.password_hash = await hashPassword(b.password);
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "ما كانش تبديل" }, { status: 400 });
  try {
    await dbUpdate("admin_users", { id: b.id }, patch);
    forgetUser(b.id);
    await audit(await actor(), "user.update", b.id, { active: patch.active, role: patch.role, password: patch.password_hash ? "changed" : undefined });
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
