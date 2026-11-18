// تسجيل الدخول للوحة التحكم: كلمة سر وحدة (ADMIN_PASSWORD فـ Vercel)
export const ADMIN_COOKIE = "dhi_admin";

async function hmac(key: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

// التوكن يتبدل وحدو إذا تبدلت كلمة السر → كل الأجهزة يخرجو
export async function adminToken(): Promise<string | null> {
  const pw = process.env.ADMIN_PASSWORD?.trim();
  if (!pw) return null;
  return hmac(`${pw}|${process.env.SUPABASE_SERVICE_ROLE_KEY || "local"}`, "dhi-admin-v1");
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function isAdmin(cookieValue: string | undefined) {
  const t = await adminToken();
  return Boolean(t && cookieValue && safeEqual(cookieValue, t));
}
