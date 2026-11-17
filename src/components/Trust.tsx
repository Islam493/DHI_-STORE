const items = [
  ["💵", "الدفع عند الاستلام", "ما تخلص حتى تشوف السلعة"],
  ["🚚", "توصيل لـ 58 ولاية", "للدار ولا للمكتب"],
  ["🛡️", "ضمان", "استبدال إذا كان عيب مصنع"],
  ["🧑‍🔧", "مساعدة فالتركيب", "نعاونوك حتى تخدم الكاميرا"],
];
export default function Trust({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${compact ? "" : "md:grid-cols-4"}`}>
      {items.map(([i, t, d]) => (
        <div key={t} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-3">
          <span className="text-2xl">{i}</span>
          <div><p className="text-sm font-extrabold text-navy">{t}</p><p className="text-xs text-muted">{d}</p></div>
        </div>
      ))}
    </div>
  );
}
