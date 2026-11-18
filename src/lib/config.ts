// إعدادات المتجر — بدّل هنا الاسم والأرقام
export const store = {
  name: "DHI Electronics",
  nameAr: "دي إتش آي إلكترونيكس",
  tagline: "أنظمة المراقبة والحماية الذكية — توصيل لـ 58 ولاية والدفع عند الاستلام",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://dhielectronics.store",
  currency: "دج",
};

export function formatPrice(n: number) {
  return `${n.toLocaleString("en-US")} ${store.currency}`;
}
