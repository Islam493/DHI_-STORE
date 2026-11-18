import { getSettings } from "@/lib/settings";

// شارات الثقة: غير الحوايج الصحيحة (الضمان يبان غير إذا كتبتو فاللوحة)
export default async function Trust({ compact = false }: { compact?: boolean }) {
  const { content, whatsapp } = await getSettings();
  const items: [string, string, string][] = [
    ["💵", "الدفع عند الاستلام", "ما تخلص حتى توصلك السلعة"],
    ["🚚", "توصيل لـ 58 ولاية", "للدار ولا للمكتب"],
    ["📞", "تأكيد بالهاتف", "نتصلو بيك قبل ما نبعثو"],
  ];
  if (content.warranty) items.push(["🛡️", "الضمان", content.warranty]);
  else if (whatsapp) items.push(["💬", "مساعدة على الواتساب", "نجاوبوك قبل وبعد الشراء"]);
  return (
    <div className={`grid grid-cols-2 gap-3 ${compact ? "" : "md:grid-cols-4"}`}>
      {items.map(([i, t, d]) => (
        <div key={t} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-3">
          <span className="text-2xl">{i}</span>
          <div><p className="text-sm font-extrabold text-navy">{t}</p><p className="text-xs leading-5 text-muted">{d}</p></div>
        </div>
      ))}
    </div>
  );
}
