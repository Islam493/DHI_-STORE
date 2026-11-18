import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/admin-api";
import { can } from "@/lib/perms";
import { dbSelect } from "@/lib/db";
import { statuses, type Order, type Status } from "@/lib/order-types";
import { contacts, getSettings } from "@/lib/settings";
import PrintButton from "./PrintButton";

export const metadata: Metadata = { title: "طباعة الطلبيات", robots: { index: false } };
export const dynamic = "force-dynamic";

const fmt = (n: number) => `${n.toLocaleString("en-US")} دج`;

export default async function Print({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const me = await currentUser();
  if (!me || !can(me.r, "orders.view")) redirect("/admin/login");
  const ids = ((await searchParams).ids || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 200);
  const orders = ids.length ? await dbSelect<Order>("orders", { in: { id: ids }, order: ["created_at", "asc"], limit: 200 }, { fresh: true }) : [];
  const c = contacts(await getSettings());

  return (
    <div className="mx-auto max-w-3xl bg-white p-4 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="font-bold text-navy">🖨️ {orders.length} طلبية للطباعة</p>
        <PrintButton />
      </div>
      {orders.length === 0 && <p className="rounded-2xl bg-soft p-8 text-center text-muted">ما كانش طلبيات</p>}
      {orders.map((o) => (
        <article key={o.id} className="mb-6 break-inside-avoid rounded-2xl border-2 border-navy/20 p-5 print:mb-0 print:break-after-page print:rounded-none print:border-0">
          <header className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="" width={48} height={48} className="rounded-full" />
              <div><p className="font-extrabold text-navy">DHI Electronics</p><p className="text-xs text-muted" dir="ltr">{c.phones.map((p) => p.n).join(" · ")}</p></div>
            </div>
            <div className="text-left">
              <p className="text-lg font-extrabold" dir="ltr">#{o.id}</p>
              <p className="text-xs text-muted">{new Date(o.created_at).toLocaleString("fr-DZ", { timeZone: "Africa/Algiers" })}</p>
            </div>
          </header>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-bold text-muted">الزبون</p>
              <p className="text-lg font-extrabold">{o.customer_name}</p>
              <p className="font-bold" dir="ltr">{o.phone}</p>
              <p className="mt-1 text-sm">{o.wilaya_code} - {o.wilaya_name} / {o.commune}</p>
              <p className="text-sm">{o.delivery_method === "desk" ? "🏢 استلام من المكتب" : `🏠 ${o.address}`}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold text-muted">الحالة</p>
              <p className="font-bold">{statuses[o.status as Status]?.label}</p>
              {o.tracking && <p className="mt-1 text-sm">🚚 رقم التتبع: <b dir="ltr">{o.tracking}</b></p>}
              {o.note && <p className="mt-1 text-sm">📝 {o.note}</p>}
            </div>
          </div>
          <table className="w-full border-t border-line text-sm">
            <thead><tr className="text-right text-xs text-muted"><th className="py-2">المنتج</th><th className="py-2 text-center">الكمية</th><th className="py-2 text-left">السعر</th></tr></thead>
            <tbody>
              <tr className="border-t border-line"><td className="py-2 font-bold">{o.product_name}{o.variant ? ` (${o.variant})` : ""}</td><td className="py-2 text-center">{o.quantity}</td><td className="py-2 text-left">{fmt(o.unit_price * o.quantity)}</td></tr>
              <tr><td className="py-1 text-muted" colSpan={2}>التوصيل</td><td className="py-1 text-left">{fmt(o.shipping_fee)}</td></tr>
              <tr className="border-t-2 border-navy"><td className="py-2 text-lg font-extrabold" colSpan={2}>المبلغ اللي يخلصو الزبون</td><td className="py-2 text-left text-lg font-extrabold">{fmt(o.total)}</td></tr>
            </tbody>
          </table>
          <p className="mt-3 text-center text-xs text-muted">شكرا على ثقتكم — DHI Electronics</p>
        </article>
      ))}
    </div>
  );
}
