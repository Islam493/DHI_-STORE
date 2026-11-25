import { NextResponse } from "next/server";
import { communes } from "@/lib/ecotrack";
import { fail, guard } from "@/lib/admin-api";
import { getSettings } from "@/lib/settings";

export async function GET(req: Request) {
  const g = await guard("orders.ship"); if (g) return g;
  const w = Number(new URL(req.url).searchParams.get("wilaya"));
  if (!(w >= 1 && w <= 58)) return NextResponse.json({ error: "ولاية غالطة" }, { status: 400 });
  const product = new URL(req.url).searchParams.get("product") || "";
  try {
    const [list, s] = await Promise.all([communes(w), getSettings(true)]);
    return NextResponse.json({ communes: list, shipName: s.shipNames?.[product] || null });
  } catch (e) { return fail(e); }
}
