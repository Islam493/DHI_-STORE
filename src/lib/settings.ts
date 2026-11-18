import { dbSelect, dbUpsert, hasSupabase } from "./db";
import { withFees, type Fees } from "./wilayas";

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
  seeded?: boolean;
};

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

export async function getWilayas(fresh = false) {
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
