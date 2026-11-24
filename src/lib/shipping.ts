// نبعثو الطلبية لـ World Express (من اللوحة ولا وحدها بعد التأكيد)
import { createParcel } from "./ecotrack";
import { updateOrder } from "./orders";
import type { Order } from "./order-types";

export async function shipOrder(o: Order, opts: { commune?: string; montant?: number; stop_desk?: boolean; remarque?: string } = {}, by = "النظام") {
  if (o.tracking) throw new Error(`الطلبية مبعوثة ديجا (${o.tracking})`);
  const commune = (opts.commune ?? o.commune ?? "").trim();
  if (!commune) throw new Error("اختار البلدية");
  const montant = Math.round(Number(opts.montant ?? o.total));
  if (!(montant >= 0)) throw new Error("المبلغ غالط");
  const desk = opts.stop_desk ?? o.delivery_method === "desk";
  const tracking = await createParcel({
    reference: o.id,
    nom_client: o.customer_name.slice(0, 255),
    telephone: o.phone.replace(/\D/g, ""),
    adresse: (desk ? `Stop desk — ${commune}` : o.address || commune).slice(0, 255),
    commune,
    code_wilaya: o.wilaya_code,
    montant,
    remarque: String(opts.remarque ?? o.note ?? "").slice(0, 255),
    produit: `${o.product_name}${o.variant ? ` (${o.variant})` : ""} x${o.quantity}`.slice(0, 255),
    stop_desk: desk ? 1 : 0,
    type: 1,
  });
  const shipped_at = new Date().toISOString();
  await updateOrder(o, { tracking, shipped_at, status: "shipped" }, by);
  return { tracking, shipped_at, order: { ...o, tracking, shipped_at, status: "shipped" } as Order };
}
