import { NextResponse } from "next/server";
import { label } from "@/lib/ecotrack";
import { fail, guard } from "@/lib/admin-api";

// البوليصة (PDF) باش تطبعها وتلصقها على الطرد
export async function GET(req: Request) {
  const g = await guard(); if (g) return g;
  const t = new URL(req.url).searchParams.get("tracking") || "";
  if (!/^[A-Za-z0-9-]{3,40}$/.test(t)) return NextResponse.json({ error: "رقم تتبع غالط" }, { status: 400 });
  try {
    const res = await label(t);
    if (!res.ok) return NextResponse.json({ error: `ما قدرناش نجيبو البوليصة (${res.status})` }, { status: 502 });
    return new NextResponse(res.body, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${t}.pdf"` } });
  } catch (e) { return fail(e); }
}
