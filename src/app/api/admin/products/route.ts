import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { dbInsert, dbSelect, hasSupabase } from "@/lib/db";
import { getAllProducts, seedProducts, toRow, type Product, type ProductRow } from "@/lib/catalog";
import { getSettings, saveSettings } from "@/lib/settings";
import { actor, fail, guard, refreshSite, withoutMissing } from "@/lib/admin-api";
import { normalize } from "./normalize";
import { dzDayStart, productsPerf } from "@/lib/stats";

export const dynamic = "force-dynamic";

// أول مرة: ننقلو المنتجات القديمة لقاعدة البيانات
async function seedIfNeeded() {
  const existing = await dbSelect<ProductRow>("products", { select: "id", limit: 1 }, { fresh: true });
  if (existing.length) return;
  const s = await getSettings(true);
  if (s.seeded) return;
  const rows = seedProducts.map(toRow);
  try { await dbInsert("products", rows); }
  catch (e) {
    if (!/PGRST204|column|schema cache/i.test(String(e))) throw e;
    await dbInsert("products", rows.map(({ landing: _l, ...r }) => { void _l; return r; }));
  }
  await saveSettings({ seeded: true });
  refreshSite("catalog");
}

export async function GET() {
  const g = await guard("products.view"); if (g) return g;
  try {
    await seedIfNeeded();
    const from = dzDayStart(29).toISOString(), to = new Date(Date.now() + 86400_000).toISOString();
    const [products, perf] = await Promise.all([getAllProducts(true), productsPerf(from, to).catch(() => [])]);
    const stats = Object.fromEntries(perf.map((x) => [x.product_id, { orders: x.orders, delivered: x.delivered, returned: x.returned }]));
    return NextResponse.json({ products, stats, storage: hasSupabase ? "supabase" : "local" });
  } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  const g = await guard("products.edit"); if (g) return g;
  try {
    const all = await getAllProducts(true);
    const r = normalize(await req.json(), all);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    const p: Product = { ...r.product, id: `p${Date.now().toString(36)}`, stock: null, sort: Math.max(-1, ...all.map((x) => x.sort ?? 0)) + 1 };
    await withoutMissing((r) => dbInsert("products", r), toRow(p));
    refreshSite("catalog");
    await audit(await actor(), "product.create", p.id, { name: p.name, price: p.price });
    return NextResponse.json({ ok: true, product: p });
  } catch (e) { return fail(e); }
}
