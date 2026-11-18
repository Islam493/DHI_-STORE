import { NextResponse } from "next/server";
import { dbPage } from "@/lib/db";
import { fail, guard } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guard("audit.view"); if (g) return g;
  const u = new URL(req.url);
  const page = Math.max(1, parseInt(u.searchParams.get("page") || "1") || 1);
  const q = (u.searchParams.get("q") || "").trim().slice(0, 40);
  try {
    const r = await dbPage("audit_log", {
      order: ["at", "desc"], limit: 50, offset: (page - 1) * 50,
      search: q ? { cols: ["user_name", "action", "target"], term: q } : undefined,
    });
    return NextResponse.json({ ...r, page });
  } catch (e) { return fail(e); }
}
