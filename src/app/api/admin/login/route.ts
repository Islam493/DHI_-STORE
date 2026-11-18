import { NextResponse } from "next/server";
import { ADMIN_COOKIE, ownerEnabled, safeEqual, signSession, type Session } from "@/lib/auth";
import { dbSelect } from "@/lib/db";
import { verifyPassword } from "@/lib/passwords";
import { audit } from "@/lib/audit";

const tries = new Map<string, number[]>();

type U = { id: string; name: string; username: string; password_hash: string; role: "admin" | "staff"; active: boolean };

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const now = Date.now();
  const list = (tries.get(ip) || []).filter((t) => now - t < 15 * 60_000);
  if (list.length >= 8) return NextResponse.json({ error: "جربت بزاف. عاود بعد 15 دقيقة." }, { status: 429 });
  if (!ownerEnabled()) return NextResponse.json({ error: "كلمة السر مازال ما تحطتش فـ Vercel (ADMIN_PASSWORD)" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase().slice(0, 40) : "";
  const password = typeof body.password === "string" ? body.password.trim().slice(0, 200) : "";

  let session: Omit<Session, "e"> | null = null;
  let days = 30;
  // المالك: "admin" (ولا فارغ) + ADMIN_PASSWORD
  if (!username || username === "admin") {
    if (safeEqual(password, process.env.ADMIN_PASSWORD!.trim())) session = { u: "owner", n: "المدير", r: "admin" };
  } else {
    try {
      const [u] = await dbSelect<U>("admin_users", { eq: { username }, limit: 1 }, { fresh: true });
      if (u?.active && (await verifyPassword(password, u.password_hash))) { session = { u: u.id, n: u.name, r: u.role }; days = 7; }
    } catch { /* الجدول مازال ما تنحّاش */ }
  }

  if (!session) {
    list.push(now); tries.set(ip, list);
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "اسم المستخدم ولا كلمة السر غالطين" }, { status: 401 });
  }
  tries.delete(ip);
  const token = await signSession(session, days);
  await audit(session.n, "login", null, { ip });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token!, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: days * 86400 });
  return res;
}
