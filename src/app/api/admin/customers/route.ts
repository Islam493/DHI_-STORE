import { NextResponse } from "next/server";
import { listCustomers } from "@/lib/customers";
import { fail, guard } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guard("customers.view"); if (g) return g;
  const u = new URL(req.url);
  const page = Math.max(1, parseInt(u.searchParams.get("page") || "1") || 1);
  try {
    const r = await listCustomers({
      q: (u.searchParams.get("q") || "").trim().slice(0, 40), sort: u.searchParams.get("sort") || "recent",
      page, per: 30, returning: u.searchParams.get("returning") === "1",
    });
    return NextResponse.json({ ...r, page, per: 30 });
  } catch (e) { return fail(e); }
}
