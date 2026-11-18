import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { ADMIN_COOKIE, isAdmin } from "./auth";

// حماية ثانية فكل API (زيادة على middleware)
export async function guard() {
  const ok = await isAdmin((await cookies()).get(ADMIN_COOKIE)?.value);
  return ok ? null : NextResponse.json({ error: "لازم تدخل" }, { status: 401 });
}

export function fail(e: unknown, status = 500) {
  console.error(e);
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: msg.includes("relation") || msg.includes("PGRST205") ? "الجداول مازال ما تنحّاوش فـ Supabase (نفّذ كود SQL)" : "صرا مشكل: " + msg.slice(0, 200) }, { status });
}

// كي يتبدل منتج ولا إعداد، الموقع يتحدث مباشرة
export function refreshSite(tag: "catalog" | "settings") {
  revalidateTag(tag);
  revalidatePath("/", "layout");
}
