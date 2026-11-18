// ربط مع شركة التوصيل World Express (منصة EcoTrack)
const BASE = (process.env.ECOTRACK_URL?.trim() || "https://world-express.ecotrack.dz").replace(/\/+$/, "");
const TOKEN = process.env.ECOTRACK_TOKEN?.trim();

export const carrier = { name: "World Express", enabled: Boolean(TOKEN), trackUrl: (t: string) => `https://suivi.ecotrack.dz/suivi/${encodeURIComponent(t)}` };

async function call(path: string, init?: RequestInit) {
  if (!TOKEN) throw new Error("مفتاح World Express مازال ما تحطش فـ Vercel (ECOTRACK_TOKEN)");
  const res = await fetch(`${BASE}/api/v1/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) throw new Error("مفتاح World Express غالط ولا ما عندوش صلاحية API");
  return res;
}

export type Commune = { name: string; desk: boolean };

export async function communes(wilaya: number): Promise<Commune[]> {
  const res = await call(`get/communes?wilaya_id=${wilaya}`);
  if (!res.ok) throw new Error(`World Express: ${res.status}`);
  const data = await res.json();
  const list: Record<string, unknown>[] = Array.isArray(data) ? data : Object.values(data?.data ?? data ?? {});
  return list
    .map((c) => ({ name: String(c.nom ?? c.name ?? c.commune ?? "").trim(), desk: Boolean(Number(c.has_stop_desk ?? c.stop_desk ?? 0)) }))
    .filter((c) => c.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type Parcel = {
  reference: string; nom_client: string; telephone: string; adresse: string; commune: string;
  code_wilaya: number; montant: number; remarque?: string; produit?: string; stop_desk: 0 | 1; type: 1;
};

export async function createParcel(p: Parcel): Promise<string> {
  const res = await call("create/order", { method: "POST", body: JSON.stringify(p) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    const errs = data?.errors ? Object.values(data.errors).flat().join(" — ") : "";
    throw new Error(`World Express رفضت: ${data?.message || res.status}${errs ? ` (${errs})` : ""}`);
  }
  const tracking = data?.tracking ?? data?.data?.tracking ?? data?.order?.tracking;
  if (!tracking) throw new Error("World Express ما رجعتش رقم التتبع");
  return String(tracking);
}

export async function label(tracking: string): Promise<Response> {
  return call(`get/order/label?tracking=${encodeURIComponent(tracking)}`);
}

export async function ping(): Promise<number> {
  return (await call("get/wilayas")).status;
}

// أسعار World Express لكل ولاية (الشكل ماشي موثق، علاه نقراو بمرونة)
export type CarrierFee = { home: number | null; desk: number | null };
const firstNum = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) { const v = Number(o[k]); if (o[k] !== undefined && o[k] !== null && o[k] !== "" && Number.isFinite(v)) return v; }
  return null;
};
export async function carrierFees(): Promise<{ fees: Record<number, CarrierFee>; keys: string[] }> {
  const res = await call("get/fees");
  if (!res.ok) throw new Error(`World Express: ${res.status}`);
  const data = await res.json();
  const list: Record<string, unknown>[] = Array.isArray(data) ? data : Array.isArray(data?.livraison) ? data.livraison : Array.isArray(data?.data) ? data.data : Object.values(data?.livraison ?? data ?? {});
  const fees: Record<number, CarrierFee> = {};
  for (const it of list) {
    if (!it || typeof it !== "object") continue;
    const w = firstNum(it, ["wilaya_id", "code_wilaya", "wilaya", "id"]);
    if (!w || w < 1 || w > 58) continue;
    fees[w] = {
      home: firstNum(it, ["tarif", "tarif_domicile", "home", "domicile", "prix", "price", "livraison"]),
      desk: firstNum(it, ["tarif_stopdesk", "tarif_stop_desk", "stopdesk", "stop_desk", "desk", "tarif_bureau"]),
    };
  }
  return { fees, keys: list[0] && typeof list[0] === "object" ? Object.keys(list[0]) : [] };
}
