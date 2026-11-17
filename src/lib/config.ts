// إعدادات المتجر — بدّل هنا الاسم والأرقام
export const store = {
  name: "DHI Electronics",
  nameAr: "دي إتش آي إلكترونيكس",
  tagline: "أنظمة المراقبة والحماية الذكية — توصيل لـ 58 ولاية والدفع عند الاستلام",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://dhielectronics.store",
  // رقم الواتساب بصيغة دولية بلا + (مثال: 213555123456)
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || "",
  // رقم الهاتف كما يظهر للزبون (مثال: 0555 12 34 56)
  phone: process.env.NEXT_PUBLIC_PHONE || "",
  currency: "دج",
};

export function formatPrice(n: number) {
  return `${n.toLocaleString("en-US")} ${store.currency}`;
}

export function whatsappLink(text?: string) {
  if (!store.whatsapp) return null;
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${store.whatsapp}${q}`;
}
