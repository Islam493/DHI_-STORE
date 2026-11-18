import { NextResponse } from "next/server";
import { communes } from "@/lib/ecotrack";
import { fail, guard } from "@/lib/admin-api";

export async function GET(req: Request) {
  const g = await guard("orders.ship"); if (g) return g;
  const w = Number(new URL(req.url).searchParams.get("wilaya"));
  if (!(w >= 1 && w <= 58)) return NextResponse.json({ error: "ولاية غالطة" }, { status: 400 });
  try { return NextResponse.json({ communes: await communes(w) }); } catch (e) { return fail(e); }
}
