// الجلسات: كوكي موقعة (HMAC) — تخدم فالـ middleware وفالسيرفر
import type { Role } from "./perms";

export const ADMIN_COOKIE = "dhi_admin";
export type Session = { u: string; n: string; r: Role; e: number };

const enc = new TextEncoder();
function secret() {
  const pw = process.env.ADMIN_PASSWORD?.trim();
  return pw ? `${pw}|${process.env.SUPABASE_SERVICE_ROLE_KEY || "local"}|v2` : null;
}

function toB64Url(s: string) {
  const bytes = enc.encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64Url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function hmac(key: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(msg));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function signSession(s: Omit<Session, "e">, days: number) {
  const key = secret();
  if (!key) return null;
  const payload = toB64Url(JSON.stringify({ ...s, e: Date.now() + days * 86400_000 }));
  return `${payload}.${await hmac(key, payload)}`;
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  const key = secret();
  if (!key || !token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sig, await hmac(key, payload))) return null;
  try {
    const s = JSON.parse(fromB64Url(payload)) as Session;
    return s.e > Date.now() && (s.r === "admin" || s.r === "staff") ? s : null;
  } catch {
    return null;
  }
}

export const ownerEnabled = () => Boolean(process.env.ADMIN_PASSWORD?.trim());
