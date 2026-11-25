"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { track } from "@/lib/track";
import { formatPrice } from "@/lib/config";

type Last = { id: string; total: number; pid: string; name: string; qty: number };

export default function ThankYou({ whatsapp }: { whatsapp: string }) {
  const id = useSearchParams().get("id");
  const [order, setOrder] = useState<Last | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    try {
      const raw = sessionStorage.getItem("lastOrder");
      if (!raw) return;
      const o: Last = JSON.parse(raw);
      if (o.id !== id) return;
      setOrder(o);
      const key = `tracked:${o.id}`;
      if (!sessionStorage.getItem(key)) {
        track("Purchase", { id: o.pid, name: o.name, value: o.total, quantity: o.qty }, 0, `o_${o.id}`); // نفس event_id تاع السيرفر (lib/capi.ts)
        sessionStorage.setItem(key, "1");
      }
    } catch {}
  }, [id]);

  const n = whatsapp.replace(/\D/g, "").replace(/^0/, "213");
  // الزبون يأكد وحدو بالواتساب = طلبية حقيقية وتخرج أسرع (وأقل روتور)
  const wa = n ? `https://wa.me/${n}?text=${encodeURIComponent(`السلام عليكم، نأكد طلبيتي رقم #${id ?? ""}${order ? ` (${order.name}) — ${formatPrice(order.total)}` : ""} ✅`)}` : null;
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="mx-auto grid size-20 place-items-center rounded-full bg-ok/10 text-4xl">✅</div>
      <h1 className="mt-6 text-3xl font-extrabold text-navy">شكرا! طلبيتك وصلت</h1>
      {id && <p className="mt-2 text-muted">رقم الطلبية: <b className="text-navy" dir="ltr">#{id}</b></p>}
      {order && <p className="mt-1 text-muted">{order.name} — المجموع <b className="text-brand">{formatPrice(order.total)}</b></p>}
      <div className="mt-8 rounded-3xl border border-line bg-soft p-6 text-right leading-8">
        <p className="font-extrabold text-navy">📞 واش يصرا دروك؟</p>
        <p>فريقنا يتصل بيك فأقرب وقت باش يأكد الطلبية. <b>خلي تيليفونك مفتوح</b> باش ما تفوتكش المكالمة.</p>
        <p>من بعد التأكيد نبعثو الطلبية، ومدة التوصيل حسب الولاية. تخلص كي تستلم.</p>
      </div>
      {wa && (
        <a href={wa} className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-wa px-6 py-4 text-lg font-extrabold text-white shadow-lg shadow-wa/30">
          💬 أكّد طلبيتك دركا على الواتساب
        </a>
      )}
      {wa && <p className="mt-2 text-xs text-muted">⚡ أسرع طريقة باش تأكد طلبيتك</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-2xl bg-navy px-6 py-3 font-bold text-white">رجوع للمتجر</Link>
      </div>
    </div>
  );
}
