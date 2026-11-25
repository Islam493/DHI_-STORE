import { NextResponse, after } from "next/server";
import { notifyTelegram } from "@/lib/orders";
import { audit } from "@/lib/audit";
import { getAllProducts } from "@/lib/catalog";
import { getWilayas } from "@/lib/settings";
import { placeOrder } from "@/lib/checkout";
import { deleteCart, getCart, isCartStatus, listCarts, markConverted, phoneHistory, purgeOld, updateCart } from "@/lib/abandoned";
import { actor, currentUser, fail, guard } from "@/lib/admin-api";
import { can } from "@/lib/perms";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guard("orders.view"); if (g) return g;
  const u = new URL(req.url);
  const s = u.searchParams.get("status") || "open";
  const status = s === "all" || isCartStatus(s) ? s : "open";
  const page = Math.max(1, parseInt(u.searchParams.get("page") || "1") || 1);
  try {
    const [list, products, wilayas] = await Promise.all([listCarts(status, page), getAllProducts(true), getWilayas(true)]);
    const history = await phoneHistory(list.rows.map((c) => c.phone));
    const images = Object.fromEntries(products.map((p) => [p.id, p.images[0] || ""]));
    return NextResponse.json({
      ...list, page, per: 30, history,
      rows: list.rows.map((c) => ({ ...c, image: images[c.product_id] || null })),
      products: products.map((p) => ({ id: p.id, slug: p.slug, name: p.name, variants: p.variants.map((v) => v.name), offers: p.variants.length ? [] : (p.offers || []).map((o) => o.qty) })),
      wilayas: wilayas.map((w) => ({ code: w.code, name: w.name, home: w.home, desk: w.desk })),
    });
  } catch (e) { return fail(e); }
}

// تبديل الحالة (تواصلنا / إهمال / رجّعها متروكة)
export async function PATCH(req: Request) {
  const g = await guard("orders.edit"); if (g) return g;
  const { ids, status } = await req.json().catch(() => ({}));
  const list: string[] = Array.isArray(ids) ? ids.filter((x: unknown) => typeof x === "string").slice(0, 200) : [];
  if (!list.length || !isCartStatus(status) || status === "converted") return NextResponse.json({ error: "معلومات غالطة" }, { status: 400 });
  try {
    const by = await actor();
    for (const id of list) {
      const c = await getCart(id);
      if (!c || c.status === "converted") continue;
      await updateCart(id, { status, ...(status === "contacted" ? { contacted_at: new Date().toISOString(), by } : {}) });
    }
    await audit(by, "abandoned.status", list.join(","), { status, count: list.length });
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}

// تحويل لطلبية حقيقية (بعد ما الزبون أكّد فالتيليفون)
export async function POST(req: Request) {
  const g = await guard("orders.edit"); if (g) return g;
  const b = await req.json().catch(() => ({}));
  try {
    const c = typeof b.id === "string" ? await getCart(b.id) : undefined;
    if (!c) return NextResponse.json({ error: "ما لقيناهاش" }, { status: 404 });
    if (c.status === "converted") return NextResponse.json({ error: "ولات طلبية من قبل", order: c.order_id }, { status: 409 });
    const by = await actor();
    const r = await placeOrder({
      product: c.product_slug || c.product_id, variant: b.variant ?? c.variant, quantity: b.quantity ?? c.quantity,
      wilaya: b.wilaya ?? c.wilaya_code, method: b.method ?? c.delivery_method, commune: b.commune ?? c.commune,
      name: b.name ?? c.name, phone: b.phone ?? c.phone, address: b.address,
    }, { ip: c.ip, extraNote: "🛍️ من الطلبات المتروكة", by });
    if (!r.ok) return NextResponse.json(r.errors ? { errors: r.errors, error: Object.values(r.errors)[0] } : { error: r.error }, { status: r.status });
    await markConverted(r.order, c.id);
    after(() => notifyTelegram(r.order));
    await audit(by, "abandoned.convert", c.id, { order: r.order.id });
    return NextResponse.json({ ok: true, order: r.order.id });
  } catch (e) { return fail(e); }
}

// حذف (المدير): مسودات مختارة، ولا القدام كامل (+30 يوم)
export async function DELETE(req: Request) {
  const g = await guard("orders.edit"); if (g) return g;
  const { ids, old } = await req.json().catch(() => ({}));
  try {
    const by = await actor();
    if (old) {
      const n = await purgeOld(30);
      await audit(by, "abandoned.purge", "", { count: n });
      return NextResponse.json({ ok: true, deleted: n });
    }
    const me = await currentUser();
    if (!can(me?.r, "orders.delete")) return NextResponse.json({ error: "غير المدير يقدر يحذف" }, { status: 403 });
    const list: string[] = Array.isArray(ids) ? ids.filter((x: unknown) => typeof x === "string").slice(0, 200) : [];
    for (const id of list) await deleteCart(id);
    await audit(by, "abandoned.delete", list.join(","), { count: list.length });
    return NextResponse.json({ ok: true, deleted: list.length });
  } catch (e) { return fail(e); }
}
