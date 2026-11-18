import { NextResponse } from "next/server";
import { getSettings, getWilayas, saveSettings } from "@/lib/settings";
import { defaultWilayas, type Fees } from "@/lib/wilayas";
import { fail, guard, refreshSite } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guard(); if (g) return g;
  try {
    const s = await getSettings(true);
    return NextResponse.json({ whatsapp: s.whatsapp, phone: s.phone, wilayas: await getWilayas(true) });
  } catch (e) { return fail(e); }
}

export async function PUT(req: Request) {
  const g = await guard(); if (g) return g;
  try {
    const b = await req.json();
    const whatsapp = String(b.whatsapp || "").replace(/[^\d+]/g, "").slice(0, 20);
    const phone = String(b.phone || "").replace(/[^\d +]/g, "").trim().slice(0, 20);
    const fees: Fees = {};
    for (const w of defaultWilayas) {
      const x = b.fees?.[w.code];
      if (!x) continue;
      const home = Math.round(Number(x.home));
      const desk = x.desk === null || x.desk === "" ? null : Math.round(Number(x.desk));
      if (!Number.isFinite(home) || home < 0 || (desk !== null && (!Number.isFinite(desk) || desk < 0))) {
        return NextResponse.json({ error: `سعر غالط فولاية ${w.name}` }, { status: 400 });
      }
      fees[w.code] = { home, desk };
    }
    await saveSettings({ whatsapp, phone, fees });
    refreshSite("settings");
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
