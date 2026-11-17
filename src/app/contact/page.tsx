import type { Metadata } from "next";
import { store, whatsappLink } from "@/lib/config";

export const metadata: Metadata = { title: "اتصل بنا" };

export default function Contact() {
  const wa = whatsappLink("السلام عليكم");
  return (
    <div className="mx-auto max-w-xl px-4 py-12 text-center">
      <h1 className="text-3xl font-extrabold text-navy">اتصل بنا</h1>
      <p className="mt-3 text-muted">عندك سؤال على منتج ولا على طلبيتك؟ راسلنا ونجاوبوك فأقرب وقت.</p>
      <div className="mt-8 grid gap-3">
        {wa && <a href={wa} className="rounded-2xl bg-wa p-4 text-lg font-extrabold text-white">💬 راسلنا على الواتساب</a>}
        {store.phone && <a href={`tel:${store.phone.replace(/\s/g, "")}`} className="rounded-2xl bg-navy p-4 text-lg font-extrabold text-white">📞 <span dir="ltr">{store.phone}</span></a>}
        {!wa && !store.phone && <p className="rounded-2xl bg-soft p-4 text-muted">(زيد رقم الواتساب والهاتف فالإعدادات)</p>}
      </div>
    </div>
  );
}
