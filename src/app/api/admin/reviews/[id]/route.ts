import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { dbDelete, dbUpdate } from "@/lib/db";
import { fail, guard } from "@/lib/admin-api";
import { clean, verifyOrder } from "@/lib/review-admin";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const g = await guard("reviews.edit"); if (g) return g;
  const { id } = await params;
  try {
    const b = await req.json().catch(() => ({}));
    if (Object.keys(b).length === 1 && typeof b.visible === "boolean") {
      await dbUpdate("reviews", { id }, { visible: b.visible });
    } else {
      const c = clean(b);
      if ("error" in c) return NextResponse.json({ error: c.error }, { status: 400 });
      await dbUpdate("reviews", { id }, { ...c.review, verified: await verifyOrder(c.review!.order_id, c.review!.product_id) });
    }
    revalidateTag("reviews");
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await guard("reviews.edit"); if (g) return g;
  const { id } = await params;
  try { await dbDelete("reviews", { id }); revalidateTag("reviews"); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
