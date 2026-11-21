import { NextResponse } from "next/server";
import { carrier, communes } from "@/lib/ecotrack";

// بلديات الولاية من World Express (نفس الأسماء اللي يقبلوها) + وين كاين مكتب
export async function GET(req: Request) {
  const w = Number(new URL(req.url).searchParams.get("w"));
  if (!(w >= 1 && w <= 58)) return NextResponse.json({ communes: [] }, { status: 400 });
  if (!carrier.enabled) return NextResponse.json({ communes: [] });
  try {
    const list = await communes(w, true);
    return NextResponse.json({ communes: list }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch {
    return NextResponse.json({ communes: [] });
  }
}
