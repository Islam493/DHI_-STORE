import { NextResponse } from "next/server";
import { dbSelect, dbUpdate } from "@/lib/db";
import { createParcel } from "@/lib/ecotrack";
import type { Order } from "@/lib/order-types";
import { fail, guard } from "@/lib/admin-api";

// يبعث الطلبية لـ World Express ويحفظ رقم التتبع
export async function POST(req: Request) {
  const g = await guard(); if (g) return g;
  const b = await req.json().catch(() => ({}));
  try {
    const [o] = await dbSelect<Order>("orders", { eq: { id: String(b.id || "") }, limit: 1 }, { fresh: true });
    if (!o) return NextResponse.json({ error: "الطلبية ما كانتش" }, { status: 404 });
    if (!("tracking" in o)) return NextResponse.json({ error: "لازم تنفّذ كود SQL تاع التوصيل فـ Supabase قبل (خانة tracking ما كانتش)" }, { status: 409 });
    if (o.tracking) return NextResponse.json({ error: `الطلبية مبعوثة ديجا (${o.tracking})` }, { status: 409 });
    const commune = String(b.commune || "").trim();
    if (!commune) return NextResponse.json({ error: "اختار البلدية" }, { status: 400 });
    const montant = Math.round(Number(b.montant));
    if (!(montant >= 0)) return NextResponse.json({ error: "المبلغ غالط" }, { status: 400 });
    const desk = b.stop_desk === 1 || b.stop_desk === true;
    const tracking = await createParcel({
      reference: o.id,
      nom_client: o.customer_name.slice(0, 255),
      telephone: o.phone.replace(/\D/g, ""),
      adresse: (desk ? `Stop desk — ${commune}` : o.address || commune).slice(0, 255),
      commune,
      code_wilaya: o.wilaya_code,
      montant,
      remarque: String(b.remarque ?? o.note ?? "").slice(0, 255),
      produit: `${o.product_name}${o.variant ? ` (${o.variant})` : ""} x${o.quantity}`.slice(0, 255),
      stop_desk: desk ? 1 : 0,
      type: 1,
    });
    const shipped_at = new Date().toISOString();
    await dbUpdate("orders", { id: o.id }, { tracking, shipped_at, status: "shipped" });
    return NextResponse.json({ ok: true, tracking, shipped_at });
  } catch (e) { return fail(e); }
}
