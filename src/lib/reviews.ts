import { dbSelect, hasSupabase } from "./db";
import type { Review } from "./review-types";
export * from "./review-types";

// الآراء الظاهرة برك. إذا الجدول مازال ما تنحّاش → لستة فارغة (بلا ما يطيح الموقع)
export async function getReviews(productId?: string): Promise<Review[]> {
  try {
    const rows = await dbSelect<Review>("reviews", { eq: { visible: true }, order: ["created_at", "desc"], limit: 500 }, { tags: ["reviews"] });
    return productId ? rows.filter((r) => r.product_id === productId) : rows;
  } catch (e) {
    if (hasSupabase) console.error("reviews:", e);
    return [];
  }
}
