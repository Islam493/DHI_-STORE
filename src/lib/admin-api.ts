import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { ADMIN_COOKIE, readSession, type Session } from "./auth";
import { can, type Perm } from "./perms";
import { dbSelect } from "./db";

// الموظفين المعطلين: نتأكدو من قاعدة البيانات (مخبّي 60 ثانية)
const activeCache = new Map<string, { ok: boolean; t: number }>();
async function stillActive(s: Session) {
  if (s.u === "owner") return true;
  const c = activeCache.get(s.u);
  if (c && Date.now() - c.t < 60_000) return c.ok;
  let ok = false;
  try {
    const [u] = await dbSelect<{ active: boolean; role: string }>("admin_users", { eq: { id: s.u }, select: "active,role", limit: 1 }, { fresh: true });
    ok = Boolean(u?.active && u.role === s.r);
  } catch {
    ok = false;
  }
  activeCache.set(s.u, { ok, t: Date.now() });
  return ok;
}
export const forgetUser = (id: string) => activeCache.delete(id);

export async function currentUser(): Promise<Session | null> {
  const s = await readSession((await cookies()).get(ADMIN_COOKIE)?.value);
  return s && (await stillActive(s)) ? s : null;
}

// حماية كل API: لازم جلسة صحيحة + الصلاحية المطلوبة (وحدة منهم تكفي)
export async function guard(perm?: Perm | Perm[]) {
  const s = await currentUser();
  if (!s) return NextResponse.json({ error: "لازم تدخل" }, { status: 401 });
  const list = perm ? (Array.isArray(perm) ? perm : [perm]) : [];
  if (list.length && !list.some((p) => can(s.r, p))) return NextResponse.json({ error: "ما عندكش الصلاحية لهاد العملية" }, { status: 403 });
  return null;
}

// اسم اللي راه يخدم (للتاريخ والسجل)
export async function actor() {
  return (await currentUser())?.n || "؟";
}

export function fail(e: unknown, status = 500) {
  console.error(e);
  const msg = e instanceof Error ? e.message : String(e);
  const sql = /relation|PGRST205|PGRST202|does not exist/.test(msg);
  return NextResponse.json({ error: sql ? "لازم تنفّذ كود SQL الجديد فـ Supabase" : "صرا مشكل: " + msg.slice(0, 200) }, { status });
}

// كي يتبدل منتج ولا إعداد، الموقع يتحدث مباشرة
export function refreshSite(tag: "catalog" | "settings") {
  revalidateTag(tag);
  revalidatePath("/", "layout");
}

const OPTIONAL_PRODUCT = ["landing", "stock", "low_stock", "sku", "cost", "featured"];

// إذا خانة جديدة مازال ما تزادتش فـ Supabase: نحفظو بلاها
export async function withoutMissing<T extends Record<string, unknown>>(fn: (row: T) => Promise<unknown>, row: T, optional = OPTIONAL_PRODUCT) {
  try {
    await fn(row);
  } catch (e) {
    if (!/PGRST204|column|schema cache/i.test(String(e))) throw e;
    const r = { ...row };
    for (const k of optional) delete r[k];
    await fn(r);
  }
}
