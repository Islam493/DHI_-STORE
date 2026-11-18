import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminToken, safeEqual } from "@/lib/auth";

const tries = new Map<string, number[]>();

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const now = Date.now();
  const list = (tries.get(ip) || []).filter((t) => now - t < 15 * 60_000);
  if (list.length >= 8) return NextResponse.json({ error: "جربت بزاف. عاود بعد 15 دقيقة." }, { status: 429 });

  const token = await adminToken();
  if (!token) return NextResponse.json({ error: "كلمة السر مازال ما تحطتش فـ Vercel (ADMIN_PASSWORD)" }, { status: 503 });

  const { password } = await req.json().catch(() => ({ password: "" }));
  const pw = process.env.ADMIN_PASSWORD!.trim();
  if (typeof password !== "string" || !safeEqual(password.trim(), pw)) {
    list.push(now); tries.set(ip, list);
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "كلمة السر غالطة" }, { status: 401 });
  }
  tries.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
