// ربط مع شركة التوصيل World Express (منصة EcoTrack)
const BASE = (process.env.ECOTRACK_URL?.trim() || "https://world-express.ecotrack.dz").replace(/\/+$/, "");
const TOKEN = process.env.ECOTRACK_TOKEN?.trim();

export const carrier = { name: "World Express", enabled: Boolean(TOKEN), trackUrl: (t: string) => `https://suivi.ecotrack.dz/suivi/${encodeURIComponent(t)}` };

async function call(path: string, init?: RequestInit, revalidate?: number) {
  if (!TOKEN) throw new Error("مفتاح World Express مازال ما تحطش فـ Vercel (ECOTRACK_TOKEN)");
  const res = await fetch(`${BASE}/api/v1/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    ...(revalidate ? { next: { revalidate } } : { cache: "no-store" as const }),
  });
  if (res.status === 401 || res.status === 403) throw new Error("مفتاح World Express غالط ولا ما عندوش صلاحية API");
  return res;
}

export type Commune = { name: string; desk: boolean };

export async function communes(wilaya: number, cached = false): Promise<Commune[]> {
  const res = await call(`get/communes?wilaya_id=${wilaya}`, undefined, cached ? 86400 : undefined);
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
export async function carrierFees(cached = false): Promise<{ fees: Record<number, CarrierFee>; keys: string[] }> {
  const res = await call("get/fees", undefined, cached ? 21600 : undefined);
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

// ---------- تتبع الطرد (حالة الطلبية عند شركة التوصيل) ----------
export type TrackState = "out_for_delivery" | "delivered" | "failed" | "returned" | "in_transit" | "unknown";
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// الكلمات اللي تستعملهم شركات التوصيل (فرنسية/عربية/إنجليزية)
export function classifyStatus(label: string): TrackState {
  const t = plain(label);
  if (!t.trim()) return "unknown";
  if (/retour|return|مرتجع|ارجاع|إرجاع/.test(t)) return "returned";
  if (/tentative|echec|injoignable|ne repond|absent|report|refus|annul|مؤجل|لم يرد|رفض|فشل/.test(t)) return "failed";
  if (/en (cours de )?livraison|out for delivery|livreur|مع الموزع|خرج.{0,6}توصيل|قيد التوصيل/.test(t)) return "out_for_delivery";
  if (/\blivree?s?\b|delivered|encaiss|تم التسليم|تم التوصيل|سلمت|مستلم/.test(t)) return "delivered";
  return "in_transit";
}

const STATUS_KEYS = ["status", "statut", "status_name", "libelle", "label", "situation", "event", "etat", "state", "description", "activity", "title"];
const DATE_KEYS = ["date", "created_at", "updated_at", "time", "datetime", "date_status", "at"];

// الجواب ماشي موثق: نلقاو آخر حدث فيه حالة (نقراو بمرونة)
export function latestStatus(data: unknown): string {
  const events: { label: string; at: number; i: number }[] = [];
  let i = 0;
  const walk = (v: unknown, depth: number) => {
    if (depth > 6 || v == null) return;
    if (Array.isArray(v)) { v.forEach((x) => walk(x, depth + 1)); return; }
    if (typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    const k = STATUS_KEYS.find((key) => typeof o[key] === "string" && (o[key] as string).trim());
    if (k) {
      const d = DATE_KEYS.map((key) => o[key]).find((x) => typeof x === "string" || typeof x === "number");
      const at = d ? new Date(typeof d === "number" && d < 1e12 ? d * 1000 : (d as string)).getTime() : NaN;
      events.push({ label: String(o[k]).trim(), at: Number.isFinite(at) ? at : NaN, i: i++ });
    }
    for (const x of Object.values(o)) if (typeof x === "object") walk(x, depth + 1);
  };
  walk(data, 0);
  if (!events.length) return "";
  const dated = events.filter((e) => Number.isFinite(e.at));
  if (dated.length) return dated.sort((a, b) => b.at - a.at || b.i - a.i)[0].label;
  return events[events.length - 1].label;
}

export async function trackingStatus(tracking: string): Promise<{ label: string; state: TrackState; raw: unknown }> {
  const res = await call(`get/tracking/info?tracking=${encodeURIComponent(tracking)}`);
  const raw = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`World Express ${res.status}`);
  const label = latestStatus(raw);
  return { label, state: classifyStatus(label), raw };
}
