import { NextResponse } from "next/server";
import { getSettings, getWilayas, saveSettings, type Settings } from "@/lib/settings";
import { defaultWilayas, type Fees } from "@/lib/wilayas";
import { carrier } from "@/lib/ecotrack";
import { fail, guard, refreshSite } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guard(); if (g) return g;
  try {
    const s = await getSettings(true);
    return NextResponse.json({ whatsapp: s.whatsapp, phone: s.phone, pixels: s.pixels, blocked: s.blocked, wilayas: await getWilayas(true), carrier: carrier.enabled });
  } catch (e) { return fail(e); }
}

// يحفظ غير الحوايج اللي تبعثو (التواصل، البيكسلات، ولا الأسعار)
export async function PUT(req: Request) {
  const g = await guard(); if (g) return g;
  try {
    const b = await req.json();
    const patch: Partial<Settings> = {};
    if (b.whatsapp !== undefined) patch.whatsapp = String(b.whatsapp || "").replace(/[^\d+]/g, "").slice(0, 20);
    if (b.phone !== undefined) patch.phone = String(b.phone || "").replace(/[^\d +]/g, "").trim().slice(0, 20);
    if (b.pixels !== undefined) {
      const c = (v: unknown) => String(v || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
      patch.pixels = { facebook: c(b.pixels.facebook), tiktok: c(b.pixels.tiktok), snapchat: c(b.pixels.snapchat) };
    }
    if (b.fees !== undefined) {
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
      patch.fees = fees;
    }
    await saveSettings(patch);
    refreshSite("settings");
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
