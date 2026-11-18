import { NextResponse } from "next/server";
import { currentUser } from "@/lib/admin-api";
import { PERMS, can, type Perm } from "@/lib/perms";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await currentUser();
  if (!s) return NextResponse.json({ error: "لازم تدخل" }, { status: 401 });
  const perms = (Object.keys(PERMS) as Perm[]).filter((p) => can(s.r, p));
  return NextResponse.json({ name: s.n, role: s.r, owner: s.u === "owner", perms });
}
