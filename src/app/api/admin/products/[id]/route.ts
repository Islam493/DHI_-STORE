import { NextResponse } from "next/server";
import { dbDelete, dbUpdate } from "@/lib/db";
import { getAllProducts, toRow } from "@/lib/catalog";
import { fail, guard, refreshSite, withoutMissing } from "@/lib/admin-api";
import { normalize } from "../normalize";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const g = await guard(); if (g) return g;
  const { id } = await params;
  try {
    const all = await getAllProducts(true);
    const cur = all.find((p) => p.id === id);
    if (!cur) return NextResponse.json({ error: "المنتج ما كانش" }, { status: 404 });
    const body = await req.json();
    // تبديل سريع (إظهار/تخبية) بلا ما نبعثو كامل المنتج
    const merged = { ...cur, description: cur.description.join("\n"), ...body };
    const r = normalize(merged, all, id);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    const row = toRow({ ...r.product, id, sort: r.product.sort ?? cur.sort });
    const { id: _id, ...patch } = row;
    void _id;
    await withoutMissing((r) => dbUpdate("products", { id }, r), patch);
    refreshSite("catalog");
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await guard(); if (g) return g;
  const { id } = await params;
  try {
    await dbDelete("products", { id });
    refreshSite("catalog");
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
