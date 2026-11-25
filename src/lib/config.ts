// إعدادات المتجر — بدّل هنا الاسم والأرقام
export const store = {
  name: "DHI Electronics",
  nameAr: "دي إتش آي إلكترونيكس",
  tagline: "أنظمة المراقبة والحماية الذكية — توصيل لـ 58 ولاية والدفع عند الاستلام",
  // رابط المتجر الحقيقي (للفيسبوك، جوجل، والمشاركة): الدومين الأساسي فـ Vercel هو www (dhielectronics.store يحوّل ليه)
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://www.dhielectronics.store").replace(/\/+$/, ""),
  currency: "دج",
};

export function formatPrice(n: number) {
  return `${n.toLocaleString("en-US")} ${store.currency}`;
}
