import { NextResponse } from "next/server";
import { capiStats, capiTest } from "@/lib/capi";
import { fail, guard } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

// فيسبوك Conversions API: الحالة + حدث تجربة
export async function GET() {
  const g = await guard("settings.edit"); if (g) return g;
  try { return NextResponse.json(await capiStats()); } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  const g = await guard("settings.edit"); if (g) return g;
  const b = await req.json().catch(() => ({}));
  const code = String(b.code || "").trim().replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
  if (!code) return NextResponse.json({ error: "حط الكود تاع التجربة (TEST…) من «Évènements de test»" }, { status: 400 });
  try {
    const r = await capiTest(code);
    if (!r.ok) return NextResponse.json({ error: `فيسبوك رفض: ${r.error}` }, { status: 400 });
    return NextResponse.json({ ok: true, received: r.received });
  } catch (e) { return fail(e); }
}
