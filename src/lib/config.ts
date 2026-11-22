// إعدادات المتجر — بدّل هنا الاسم والأرقام
export const store = {
  name: "DHI Electronics",
  nameAr: "دي إتش آي إلكترونيكس",
  tagline: "أنظمة المراقبة والحماية الذكية — توصيل لـ 58 ولاية والدفع عند الاستلام",
  // رابط المتجر الحقيقي (للفيسبوك، جوجل، والمشاركة). Vercel يعطيه وحدو، وكي تربط دومين يتبدل وحدو
  url: (process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://dhi-store-dhi11.vercel.app")).replace(/\/+$/, ""),
  currency: "دج",
};

export function formatPrice(n: number) {
  return `${n.toLocaleString("en-US")} ${store.currency}`;
}
