import { NextResponse } from "next/server";
import { dbInsert, dbSelect, hasSupabase } from "@/lib/db";
import { getAllProducts, seedProducts, toRow, type Product, type ProductRow } from "@/lib/catalog";
import { getSettings, saveSettings } from "@/lib/settings";
import { fail, guard, refreshSite } from "@/lib/admin-api";
import { normalize } from "./normalize";

export const dynamic = "force-dynamic";

// أول مرة: ننقلو المنتجات القديمة لقاعدة البيانات
async function seedIfNeeded() {
  const rows = await dbSelect<ProductRow>("products", { select: "id", limit: 1 }, { fresh: true });
  if (rows.length) return;
  const s = await getSettings(true);
  if (s.seeded) return;
  await dbInsert("products", seedProducts.map(toRow));
  await saveSettings({ seeded: true });
  refreshSite("catalog");
}

export async function GET() {
  const g = await guard(); if (g) return g;
  try {
    await seedIfNeeded();
    return NextResponse.json({ products: await getAllProducts(true), storage: hasSupabase ? "supabase" : "local" });
  } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  const g = await guard(); if (g) return g;
  try {
    const all = await getAllProducts(true);
    const r = normalize(await req.json(), all);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    const p: Product = { ...r.product, id: `p${Date.now().toString(36)}`, sort: Math.max(-1, ...all.map((x) => x.sort ?? 0)) + 1 };
    await dbInsert("products", toRow(p));
    refreshSite("catalog");
    return NextResponse.json({ ok: true, product: p });
  } catch (e) { return fail(e); }
}
