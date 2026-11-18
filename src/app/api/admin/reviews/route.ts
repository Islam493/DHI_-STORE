import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { dbInsert, dbSelect } from "@/lib/db";
import type { Review } from "@/lib/reviews";
import { fail, guard } from "@/lib/admin-api";
import { clean, verifyOrder } from "@/lib/review-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guard("reviews.edit"); if (g) return g;
  try { return NextResponse.json({ reviews: await dbSelect<Review>("reviews", { order: ["created_at", "desc"], limit: 1000 }, { fresh: true }) }); }
  catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  const g = await guard("reviews.edit"); if (g) return g;
  try {
    const c = clean(await req.json().catch(() => ({})));
    if ("error" in c) return NextResponse.json({ error: c.error }, { status: 400 });
    const review: Review = { ...c.review!, id: `r${Date.now().toString(36)}`, created_at: new Date().toISOString(), verified: await verifyOrder(c.review!.order_id, c.review!.product_id) };
    await dbInsert("reviews", review);
    revalidateTag("reviews");
    return NextResponse.json({ ok: true, review });
  } catch (e) { return fail(e); }
}
