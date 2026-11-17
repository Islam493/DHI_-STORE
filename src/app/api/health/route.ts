import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// صفحة فحص: تقول واش Supabase مربوط مليح (بلا ما تبين المفاتيح)
export async function GET() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const keyType = !key ? "missing"
    : key.startsWith("sb_secret_") ? "secret (new)"
    : key.startsWith("sb_publishable_") ? "publishable (WRONG - need secret)"
    : key.startsWith("eyJ") ? "jwt (legacy)" : "unknown format";
  const out: Record<string, unknown> = { url: url ? url.replace(/^https:\/\/([a-z0-9]{4})[a-z0-9]+/, "https://$1****") : "missing", keyType, keyLength: key?.length ?? 0 };
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/orders?select=id&limit=1`, {
        headers: { apikey: key, ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }) },
        cache: "no-store",
      });
      out.supabaseStatus = res.status;
      if (!res.ok) out.supabaseError = (await res.text()).slice(0, 300);
    } catch (e) {
      out.supabaseError = String(e).slice(0, 300);
    }
  }
  return NextResponse.json(out);
}
