import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { dbInsert, dbPage, dbUpdate } from "@/lib/db";
import { getAllProducts } from "@/lib/catalog";
import { adjustStock, availableStock } from "@/lib/stock";
import { audit } from "@/lib/audit";
import { actor, fail, guard, refreshSite } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guard("products.view"); if (g) return g;
  const u = new URL(req.url);
  const product = u.searchParams.get("product") || "";
  const page = Math.max(1, parseInt(u.searchParams.get("page") || "1") || 1);
  try {
    const products = await getAllProducts(true);
    let moves = { rows: [] as Record<string, unknown>[], total: 0 };
    try {
      moves = await dbPage("stock_movements", { ...(product ? { eq: { product_id: product } } : {}), order: ["at", "desc"], limit: 30, offset: (page - 1) * 30 });
    } catch { /* الجدول مازال ما تنحّاش */ }
    return NextResponse.json({
      products: products.map((p) => ({ id: p.id, name: p.name, image: p.images[0] || null, sku: p.sku, stock: p.stock ?? null, lowStock: p.lowStock ?? null, active: p.active })),
      moves: moves.rows, total: moves.total, page,
    });
  } catch (e) { return fail(e); }
}

// وصول سلعة / تالف / تصحيح العدد / تفعيل أو إيقاف التتبع
export async function POST(req: Request) {
  const g = await guard("inventory.edit"); if (g) return g;
  const b = await req.json().catch(() => ({}));
  const id = typeof b.product_id === "string" ? b.product_id : "";
  const qty = Math.round(Number(b.qty));
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 120) : "";
  const type = String(b.type || "");
  if (!id) return NextResponse.json({ error: "اختار المنتج" }, { status: 400 });
  const by = await actor();
  try {
    const cur = await availableStock(id);
    if (type === "enable") {
      if (!(qty >= 0)) return NextResponse.json({ error: "العدد غالط" }, { status: 400 });
      if (cur !== null) return NextResponse.json({ error: "المخزون متبوع ديجا" }, { status: 409 });
      await dbUpdate("products", { id }, { stock: qty });
      await dbInsert("stock_movements", { at: new Date().toISOString(), product_id: id, delta: qty, stock_after: qty, reason: "initial", ref: note || null, user_name: by }).catch(() => {});
    } else if (type === "disable") {
      await dbUpdate("products", { id }, { stock: null });
    } else {
      if (cur === null) return NextResponse.json({ error: "فعّل تتبع المخزون لهاد المنتج قبل" }, { status: 409 });
      if (!(qty >= 0) || (type !== "set" && qty === 0)) return NextResponse.json({ error: "العدد غالط" }, { status: 400 });
      const delta = type === "incoming" ? qty : type === "damaged" ? -qty : type === "set" ? qty - cur : NaN;
      if (Number.isNaN(delta)) return NextResponse.json({ error: "نوع العملية غالط" }, { status: 400 });
      if (delta === 0) return NextResponse.json({ ok: true });
      const r = await adjustStock(id, delta, type === "set" ? "adjust" : type, note || null, by);
      if (!r.ok) return NextResponse.json({ error: `ما يكفيش (باقي ${r.stock})` }, { status: 409 });
    }
    revalidateTag("catalog");
    refreshSite("catalog");
    await audit(by, `stock.${type}`, id, { qty, note });
    return NextResponse.json({ ok: true, stock: await availableStock(id) });
  } catch (e) {
    const msg = String(e);
    if (/PGRST204|column/.test(msg)) return NextResponse.json({ error: "لازم تنفّذ كود SQL الجديد (خانة المخزون)" }, { status: 409 });
    return fail(e);
  }
}
