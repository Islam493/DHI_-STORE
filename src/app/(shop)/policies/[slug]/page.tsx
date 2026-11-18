import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWilayas } from "@/lib/settings";
import { formatPrice } from "@/lib/config";

const pages = {
  shipping: {
    title: "التوصيل والأسعار",
    body: [
      "نوصلو لكامل الولايات الـ 58، للدار ولا لمكتب شركة التوصيل.",
      "مدة التوصيل عادة من 24 لـ 72 ساعة بعد تأكيد الطلبية، وتقدر تزيد شوية فالولايات البعيدة.",
      "الدفع عند الاستلام: تخلص للموزع كي توصلك السلعة.",
      "قبل ما نبعثو، نتصلو بيك باش نأكدو الطلبية والعنوان.",
    ],
  },
  returns: {
    title: "الإرجاع والاستبدال",
    body: [
      "إذا وصلك منتج فيه عيب مصنع ولا ماشي هو اللي طلبتو، اتصل بينا فـ 48 ساعة من الاستلام.",
      "نبدلوهولك بلا مصاريف إضافية إذا كان الخطأ من عندنا.",
      "المنتج لازم يرجع فالعلبة تاعو مع كامل الإكسسوارات.",
      "ما يتقبلش الإرجاع إذا كان المنتج مكسور بسبب سوء الاستعمال.",
      "الضمان يغطي الأعطال التقنية فالمدة المذكورة فصفحة كل منتج.",
    ],
  },
} as const;

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return Object.keys(pages).map((slug) => ({ slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = pages[(await params).slug as keyof typeof pages];
  return p ? { title: p.title } : {};
}

export default async function Policy({ params }: Props) {
  const slug = (await params).slug as keyof typeof pages;
  const p = pages[slug];
  if (!p) notFound();
  const wilayas = await getWilayas();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-extrabold text-navy">{p.title}</h1>
      <ul className="space-y-3 leading-8">{p.body.map((l) => <li key={l} className="rounded-2xl bg-soft p-4">• {l}</li>)}</ul>
      {slug === "shipping" && (
        <div className="mt-8 overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-navy text-white"><tr><th className="p-3 text-right">الولاية</th><th className="p-3">للدار</th><th className="p-3">للمكتب</th></tr></thead>
            <tbody>
              {wilayas.map((w) => (
                <tr key={w.code} className="border-t border-line odd:bg-soft">
                  <td className="p-3">{String(w.code).padStart(2, "0")} - {w.name}</td>
                  <td className="p-3 text-center">{formatPrice(w.home)}</td>
                  <td className="p-3 text-center">{w.desk === null ? "—" : formatPrice(w.desk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
