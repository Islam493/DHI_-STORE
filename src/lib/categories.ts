// أقسام المتجر (يستعملهم المتصفح والسيرفر)
export const categories = [
  { slug: "cameras-4g", name: "كاميرات 4G والطاقة الشمسية", short: "4G وشمسية", icon: "☀️" },
  { slug: "cameras-wifi", name: "كاميرات WiFi", short: "WiFi", icon: "📶" },
  { slug: "hidden", name: "كاميرات سرية", short: "سرية", icon: "🕵️" },
  { slug: "home-security", name: "أمان الدار", short: "أمان الدار", icon: "🏠" },
  { slug: "gadgets", name: "أجهزة ذكية", short: "أجهزة ذكية", icon: "🔍" },
] as const;
