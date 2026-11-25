// المخزون: نقص كي تجي طلبية، ونرجعو كي تتلغى ولا ترجع. ما نبيعوش أكثر من اللي كاين
import { dbInsert, dbRpc, dbSelect, dbUpdate, hasSupabase } from "./db";
import { revalidateTag } from "next/cache";

export type StockResult = { tracked: boolean; ok: boolean; stock: number | null };

async function readStock(productId: string): Promise<{ stock: number | null; low: number }> {
  try {
    const [p] = await dbSelect<{ stock: number | null; low_stock?: number | null }>("products", { eq: { id: productId }, select: "stock,low_stock", limit: 1 }, { fresh: true });
    return { stock: p && typeof p.stock === "number" ? p.stock : null, low: p?.low_stock ?? 3 };
  } catch {
    return { stock: null, low: 3 }; // الخانة مازال ما تزادتش → ما نتبعوش المخزون
  }
}

export async function availableStock(productId: string) {
  return (await readStock(productId)).stock;
}

export async function adjustStock(productId: string, delta: number, reason: string, ref: string | null, by: string): Promise<StockResult> {
  const { stock: cur, low } = await readStock(productId);
  if (cur === null) return { tracked: false, ok: true, stock: null };
  let after: number | null;
  if (hasSupabase) {
    after = await dbRpc<number | null>("dhi_adjust_stock", { p_id: productId, p_delta: delta });
  } else {
    after = cur + delta >= 0 ? cur + delta : null;
    if (after !== null) await dbUpdate("products", { id: productId }, { stock: after });
  }
  if (after === null) return { tracked: true, ok: false, stock: cur };
  try {
    await dbInsert("stock_movements", { at: new Date().toISOString(), product_id: productId, delta, stock_after: after, reason, ref, user_name: by });
  } catch (e) {
    console.error("stock_movements:", String(e).slice(0, 150));
  }
  // صفحات المنتجات تتعاود تتبنى غير كي يتبدّل واش يبان للزبون («باقي X» ولا «نفذ»)، باش المتجر يبقى سريع
  if (Math.min(cur, after) <= Math.max(low, 3)) revalidateTag("catalog");
  return { tracked: true, ok: true, stock: after };
}
