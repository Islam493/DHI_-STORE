import { dbSelect, dbUpsert, hasSupabase } from "./db";
import { withFees, type Fees } from "./wilayas";
import { carrier, carrierFees, type CarrierFee } from "./ecotrack";

// معلومات التواصل الرسمية (القيم الافتراضية — تتبدل من اللوحة: الإعدادات)
export const OFFICIAL = {
  phone: "0563758499",
  phone2: "0561389326",
  socials: {
    instagram: "https://www.instagram.com/dhi_electronics?bqrl=MTUwMXRqcG9scmZnaQ==",
    facebook: "https://www.facebook.com/share/1Jmbd9pDCi/",
    tiktok: "https://www.tiktok.com/@dhielectronics",
  },
};

// محتوى المتجر: كامل يتبدل من اللوحة (ما نكتبو حتى وعد ما كانش)
export type StoreContent = {
  successOrders: number | null; // عدد الطلبيات الناجحة (رقمك الحقيقي)
  announcement: string[];
  socials: { facebook: string; instagram: string; tiktok: string };
  warranty: string; // فارغ = ما يبانش
  delivery: string[];
  returns: string[];
  faqs: { q: string; a: string }[];
};

export const defaultContent: StoreContent = {
  successOrders: null,
  announcement: ["💵 الدفع عند الاستلام", "🚚 توصيل إلى 58 ولاية", "📦 يوصلك حتى باب دارك", "🛡️ طلبك بكل أمان"],
  socials: OFFICIAL.socials,
  warranty: "",
  delivery: [
    "نوصلو لكامل الولايات الـ 58، للدار ولا لمكتب شركة التوصيل.",
    "الدفع عند الاستلام: تخلص كي توصلك السلعة.",
    "قبل ما نبعثو، نتصلو بيك باش نأكدو الطلبية والعنوان.",
    "مدة التوصيل تختلف حسب الولاية، ونقولوهالك كي نأكدو الطلبية.",
  ],
  returns: ["إذا كان عندك أي مشكل مع الطلبية، تواصل معنا على الواتساب ولا الهاتف ونلقاو الحل مع بعض."],
  faqs: [
    { q: "كيفاش نطلب؟", a: "تعمّر الفورم فصفحة المنتج (الاسم، الهاتف، الولاية، البلدية) وفريقنا يتصل بيك باش يأكد الطلبية." },
    { q: "كيفاش نخلص؟", a: "الدفع عند الاستلام: تخلص كي توصلك السلعة، ما تخلص حتى دورو قبل." },
    { q: "شحال يدي التوصيل؟", a: "المدة تختلف حسب الولاية، ونقولوهالك كي نتصلو بيك باش نأكدو." },
    { q: "نقدر نستلم من المكتب؟", a: "إيه، فالولايات اللي فيها مكتب شركة التوصيل. السعر يبان فالفورم كي تختار الولاية." },
    { q: "عندي سؤال قبل ما نطلب؟", a: "راسلنا على الواتساب ونجاوبوك على كل أسئلتك." },
  ],
};

export type Settings = {
  whatsapp: string; // رقم الواتساب الأول
  whatsapp2: string; // رقم الواتساب الثاني
  phone: string; // الهاتف الأول
  phone2: string; // الهاتف الثاني
  fees: Fees;
  pixels: { facebook: string; tiktok: string; snapchat: string };
  blocked: { phones: string[]; ips: string[] };
  content: StoreContent;
  // حساب الربح: سعر التوصيل اللي تخلصو لـ World Express + مصاريف المرجوع + عمولة
  profit: { carrierFees: Record<string, { home: number | null; desk: number | null }>; returnFee: number; codPercent: number };
  // الأتمتة: تأكيد بالواتساب، تذكير، إرسال لشركة التوصيل، تتبع الطلبية حتى توصل
  automation: Automation;
  // الاسم اللي يتكتب فالبوليصة تاع World Express لكل منتج (يتفكر آخر اسم كتبتو)
  shipNames: Record<string, string>;
  // روبوت فيسبوك/انستغرام: يجاوب على الرسائل والكومونتيرات
  social: Social;
  seeded?: boolean;
};
export type Automation = { confirm: boolean; reminderHours: number; noAnswerHours: number; autoShip: boolean; tracking: boolean; messages: boolean };
export const defaultAutomation: Automation = { confirm: true, reminderHours: 3, noAnswerHours: 24, autoShip: false, tracking: true, messages: true };
// enabled = الزر الكبير (مطفي حتى يشعلو صاحب المتجر). note = تعليمات زايدة من عندو (عرض هاد السمانة...)
export type Social = { enabled: boolean; dm: boolean; comments: boolean; publicReply: boolean; privateReply: boolean; humanHours: number; note: string };
export const defaultSocial: Social = { enabled: false, dm: true, comments: true, publicReply: true, privateReply: true, humanHours: 12, note: "" };

const defaults = (): Settings => ({
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || OFFICIAL.phone,
  whatsapp2: OFFICIAL.phone2,
  phone: process.env.NEXT_PUBLIC_PHONE || OFFICIAL.phone,
  phone2: OFFICIAL.phone2,
  fees: {},
  pixels: {
    facebook: process.env.NEXT_PUBLIC_FB_PIXEL_ID || "",
    tiktok: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || "",
    snapchat: process.env.NEXT_PUBLIC_SNAP_PIXEL_ID || "",
  },
  blocked: { phones: [], ips: [] },
  content: defaultContent,
  profit: { carrierFees: {}, returnFee: 0, codPercent: 0 },
  automation: defaultAutomation,
  shipNames: {},
  social: defaultSocial,
});

export async function getSettings(fresh = false): Promise<Settings> {
  try {
    const rows = await dbSelect<{ id: number; data: Partial<Settings> }>("settings", { eq: { id: 1 } }, { tags: ["settings"], fresh });
    const d = rows[0]?.data || {};
    const base = defaults();
    return {
      ...base, ...d,
      whatsapp: d.whatsapp || base.whatsapp, whatsapp2: d.whatsapp2 || base.whatsapp2,
      phone: d.phone || base.phone, phone2: d.phone2 || base.phone2, fees: d.fees || {},
      pixels: {
        facebook: d.pixels?.facebook || base.pixels.facebook,
        tiktok: d.pixels?.tiktok || base.pixels.tiktok,
        snapchat: d.pixels?.snapchat || base.pixels.snapchat,
      },
      blocked: { phones: d.blocked?.phones || [], ips: d.blocked?.ips || [] },
      profit: { carrierFees: d.profit?.carrierFees || {}, returnFee: Number(d.profit?.returnFee) || 0, codPercent: Number(d.profit?.codPercent) || 0 },
      automation: { ...defaultAutomation, ...(d.automation || {}) },
      social: { ...defaultSocial, ...(d.social || {}) },
      shipNames: d.shipNames || {},
      content: {
        ...defaultContent, ...(d.content || {}),
        socials: {
          facebook: d.content?.socials?.facebook || OFFICIAL.socials.facebook,
          instagram: d.content?.socials?.instagram || OFFICIAL.socials.instagram,
          tiktok: d.content?.socials?.tiktok || OFFICIAL.socials.tiktok,
        },
      },
    };
  } catch (e) {
    if (hasSupabase) console.error("settings:", e);
    return defaults();
  }
}

export async function saveSettings(patch: Partial<Settings>) {
  const cur = await getSettings(true);
  await dbUpsert("settings", { id: 1, data: { ...cur, ...patch }, updated_at: new Date().toISOString() });
}

// أسعار التوصيل للزبون = أسعار World Express. المكتب يبان غير وين كاين مكتب (سعر المكتب > 0)
async function carrierPrices(s: Settings): Promise<Record<string, CarrierFee> | null> {
  const saved = (s.profit?.carrierFees || {}) as Record<string, CarrierFee>;
  if (Object.values(saved).some((f) => Number(f?.home) > 0)) return saved;
  if (!carrier.enabled) return null;
  try { return (await carrierFees(true)).fees; } catch { return null; }
}

export async function getWilayas(fresh = false) {
  const s = await getSettings(fresh);
  const base = withFees(s.fees);
  const we = await carrierPrices(s);
  if (!we) return base;
  return base.map((w) => {
    const f = we[w.code];
    if (!f || !(Number(f.home) > 0)) return w;
    return { ...w, home: Number(f.home), desk: Number(f.desk) > 0 ? Number(f.desk) : null };
  });
}

// الأسعار اليدوية برك (لصفحة الإعدادات)
export async function getManualWilayas(fresh = false) {
  return withFees((await getSettings(fresh)).fees);
}

export function waLink(number: string, text?: string) {
  const n = number.replace(/\D/g, "").replace(/^0/, "213");
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

// كل أرقام التواصل فبلاصة وحدة (للمتجر)
export function contacts(s: Settings) {
  const tel = (n: string) => `tel:${n.replace(/[^\d+]/g, "")}`;
  const phones = [s.phone, s.phone2].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  const was = [s.whatsapp, s.whatsapp2].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  return {
    phones: phones.map((n) => ({ n, href: tel(n) })),
    whatsapps: was.map((n) => ({ n, href: waLink(n)! })),
    socials: s.content.socials,
  };
}
