// المخزون: نقص كي تجي طلبية، ونرجعو كي تتلغى ولا ترجع. ما نبيعوش أكثر من اللي كاين
import { dbInsert, dbRpc, dbSelect, dbUpdate, hasSupabase } from "./db";
import { revalidateTag } from "next/cache";

export type StockResult = { tracked: boolean; ok: boolean; stock: number | null };

async function currentStock(productId: string): Promise<number | null> {
  try {
    const [p] = await dbSelect<{ stock: number | null }>("products", { eq: { id: productId }, select: "stock", limit: 1 }, { fresh: true });
    return p && typeof p.stock === "number" ? p.stock : null;
  } catch {
    return null; // الخانة مازال ما تزادتش → ما نتبعوش المخزون
  }
}

export async function availableStock(productId: string) {
  return currentStock(productId);
}

export async function adjustStock(productId: string, delta: number, reason: string, ref: string | null, by: string): Promise<StockResult> {
  const cur = await currentStock(productId);
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
  revalidateTag("catalog");
  return { tracked: true, ok: true, stock: after };
}
