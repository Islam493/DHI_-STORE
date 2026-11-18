import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getSettings, saveSettings } from "@/lib/settings";
import { actor, fail, guard, refreshSite } from "@/lib/admin-api";

// حظر / فك حظر رقم ولا IP
export async function POST(req: Request) {
  const g = await guard("block"); if (g) return g;
  const b = await req.json().catch(() => ({}));
  const phone = typeof b.phone === "string" ? b.phone.replace(/\D/g, "").slice(0, 10) : "";
  const ip = typeof b.ip === "string" ? b.ip.trim().slice(0, 45) : "";
  if (!phone && !ip) return NextResponse.json({ error: "ما كانش رقم ولا IP" }, { status: 400 });
  try {
    const { blocked } = await getSettings(true);
    const toggle = (list: string[], v: string) => (!v ? list : b.unblock ? list.filter((x) => x !== v) : [...new Set([...list, v])]);
    const next = { phones: toggle(blocked.phones, phone), ips: toggle(blocked.ips, ip) };
    await saveSettings({ blocked: next });
    await audit(await actor(), b.unblock ? "unblock" : "block", phone || ip);
    refreshSite("settings");
    return NextResponse.json({ ok: true, blocked: next });
  } catch (e) { return fail(e); }
}
