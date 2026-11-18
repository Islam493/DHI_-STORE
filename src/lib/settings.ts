import { dbSelect, dbUpsert, hasSupabase } from "./db";
import { withFees, type Fees } from "./wilayas";

export type Settings = {
  whatsapp: string; // صيغة دولية بلا + (213...)
  phone: string;
  fees: Fees;
  seeded?: boolean;
};

const defaults = (): Settings => ({
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || "",
  phone: process.env.NEXT_PUBLIC_PHONE || "",
  fees: {},
});

export async function getSettings(fresh = false): Promise<Settings> {
  try {
    const rows = await dbSelect<{ id: number; data: Partial<Settings> }>("settings", { eq: { id: 1 } }, { tags: ["settings"], fresh });
    const d = rows[0]?.data || {};
    const base = defaults();
    return { ...base, ...d, whatsapp: d.whatsapp || base.whatsapp, phone: d.phone || base.phone, fees: d.fees || {} };
  } catch (e) {
    if (hasSupabase) console.error("settings:", e);
    return defaults();
  }
}

export async function saveSettings(patch: Partial<Settings>) {
  const cur = await getSettings(true);
  await dbUpsert("settings", { id: 1, data: { ...cur, ...patch }, updated_at: new Date().toISOString() });
}

export async function getWilayas(fresh = false) {
  return withFees((await getSettings(fresh)).fees);
}

export function waLink(number: string, text?: string) {
  const n = number.replace(/\D/g, "").replace(/^0/, "213");
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
