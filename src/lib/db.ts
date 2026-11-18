// طبقة البيانات: Supabase على الإنترنت، وملفات JSON محلية للتجربة على الكمبيوتر
import { promises as fs } from "fs";
import path from "path";

const URL_ = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
export const hasSupabase = Boolean(URL_ && KEY);

type Val = string | number | boolean;
export type Query = {
  eq?: Record<string, Val>;
  gte?: Record<string, Val>;
  search?: { cols: string[]; term: string };
  order?: [string, "asc" | "desc"];
  limit?: number;
  offset?: number;
  select?: string;
};
export type CacheOpts = { tags?: string[]; fresh?: boolean };

function headers(extra: Record<string, string> = {}) {
  return {
    apikey: KEY!,
    ...(KEY!.startsWith("sb_") ? {} : { Authorization: `Bearer ${KEY}` }),
    ...extra,
  };
}

function qs(q: Query) {
  const p = new URLSearchParams();
  p.set("select", q.select || "*");
  for (const [k, v] of Object.entries(q.eq || {})) p.set(k, `eq.${v}`);
  for (const [k, v] of Object.entries(q.gte || {})) p.append(k, `gte.${v}`);
  if (q.search?.term) {
    const t = q.search.term.replace(/[,()*%\\]/g, " ").trim();
    if (t) p.set("or", `(${q.search.cols.map((c) => `${c}.ilike.*${t}*`).join(",")})`);
  }
  if (q.order) p.set("order", `${q.order[0]}.${q.order[1]}`);
  if (q.limit) p.set("limit", String(q.limit));
  if (q.offset) p.set("offset", String(q.offset));
  return p.toString();
}

function eqParams(eq: Record<string, Val>) {
  return new URLSearchParams(Object.entries(eq).map(([k, v]) => [k, `eq.${v}`])).toString();
}

async function check(res: Response) {
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}

// ---------- محلي (للتجربة برك) ----------
const LOCAL_DIR = path.join(process.cwd(), "data", "local-db");
async function readLocal<T>(table: string): Promise<T[]> {
  try { return JSON.parse(await fs.readFile(path.join(LOCAL_DIR, `${table}.json`), "utf8")); } catch { return []; }
}
async function writeLocal(table: string, rows: unknown[]) {
  if (process.env.VERCEL) throw new Error("Supabase is not configured");
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, `${table}.json`), JSON.stringify(rows, null, 2));
}
function localFilter<T extends Record<string, unknown>>(rows: T[], q: Query) {
  let r = rows.filter((x) =>
    Object.entries(q.eq || {}).every(([k, v]) => String(x[k]) === String(v)) &&
    Object.entries(q.gte || {}).every(([k, v]) => String(x[k]) >= String(v)));
  if (q.search?.term) {
    const t = q.search.term.toLowerCase();
    r = r.filter((x) => q.search!.cols.some((c) => String(x[c] ?? "").toLowerCase().includes(t)));
  }
  if (q.order) {
    const [k, d] = q.order;
    r = [...r].sort((a, b) => (a[k] as never) > (b[k] as never) ? 1 : (a[k] as never) < (b[k] as never) ? -1 : 0);
    if (d === "desc") r.reverse();
  }
  const off = q.offset || 0;
  return q.limit ? r.slice(off, off + q.limit) : r.slice(off);
}

// ---------- العمليات ----------
export async function dbSelect<T extends Record<string, unknown>>(table: string, q: Query = {}, c: CacheOpts = {}): Promise<T[]> {
  if (!hasSupabase) return localFilter(await readLocal<T>(table), q);
  const res = await fetch(`${URL_}/rest/v1/${table}?${qs(q)}`, {
    headers: headers(),
    ...(c.fresh ? { cache: "no-store" as const } : { next: { tags: c.tags || [table], revalidate: 3600 } }),
  });
  return (await check(res)).json();
}

export async function dbInsert<T>(table: string, rows: T | T[]) {
  if (!hasSupabase) {
    const all = await readLocal<T>(table);
    await writeLocal(table, [...(Array.isArray(rows) ? rows : [rows]), ...all]);
    return;
  }
  await check(await fetch(`${URL_}/rest/v1/${table}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify(rows),
    cache: "no-store",
  }));
}

export async function dbUpsert<T>(table: string, row: T) {
  if (!hasSupabase) {
    const all = await readLocal<Record<string, unknown>>(table);
    const r = row as Record<string, unknown>;
    const i = all.findIndex((x) => x.id === r.id);
    if (i >= 0) all[i] = { ...all[i], ...r }; else all.unshift(r);
    await writeLocal(table, all);
    return;
  }
  await check(await fetch(`${URL_}/rest/v1/${table}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(row),
    cache: "no-store",
  }));
}

export async function dbUpdate(table: string, eq: Record<string, Val>, patch: Record<string, unknown>) {
  if (!hasSupabase) {
    const all = await readLocal<Record<string, unknown>>(table);
    await writeLocal(table, all.map((x) => Object.entries(eq).every(([k, v]) => String(x[k]) === String(v)) ? { ...x, ...patch } : x));
    return;
  }
  await check(await fetch(`${URL_}/rest/v1/${table}?${eqParams(eq)}`, {
    method: "PATCH",
    headers: headers({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify(patch),
    cache: "no-store",
  }));
}

export async function dbDelete(table: string, eq: Record<string, Val>) {
  if (!hasSupabase) {
    const all = await readLocal<Record<string, unknown>>(table);
    await writeLocal(table, all.filter((x) => !Object.entries(eq).every(([k, v]) => String(x[k]) === String(v))));
    return;
  }
  await check(await fetch(`${URL_}/rest/v1/${table}?${eqParams(eq)}`, { method: "DELETE", headers: headers(), cache: "no-store" }));
}

// ---------- الصور ----------
export async function uploadImage(file: Blob, name: string): Promise<string> {
  const ext = (name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  if (!hasSupabase) {
    if (process.env.VERCEL) throw new Error("Supabase is not configured");
    const dir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, key), Buffer.from(await file.arrayBuffer()));
    return `/uploads/${key}`;
  }
  await check(await fetch(`${URL_}/storage/v1/object/products/${key}`, {
    method: "POST",
    headers: headers({ "Content-Type": file.type || "image/jpeg", "x-upsert": "false", "cache-control": "31536000" }),
    body: file,
    cache: "no-store",
  }));
  return `${URL_}/storage/v1/object/public/products/${key}`;
}
