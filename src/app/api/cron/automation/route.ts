import { NextResponse } from "next/server";
import { tick } from "@/lib/automation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// الدورة الأوتوماتيكية: Vercel Cron (Authorization: Bearer CRON_SECRET) ولا cron-job.org (?key=CRON_SECRET)
export async function GET(req: Request) {
  const key = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization");
  const q = new URL(req.url).searchParams.get("key");
  if (!key || (auth !== `Bearer ${key}` && q !== key)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...(await tick()) }); }
  catch (e) { console.error(e); return NextResponse.json({ ok: false, error: String((e as Error).message).slice(0, 200) }, { status: 500 }); }
}
