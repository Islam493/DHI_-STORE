import { dbSelect, dbUpsert, hasSupabase } from "./db";
import { withFees, type Fees } from "./wilayas";

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
  socials: { facebook: "", instagram: "", tiktok: "" },
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
  whatsapp: string; // صيغة دولية بلا + (213...)
  phone: string;
  fees: Fees;
  pixels: { facebook: string; tiktok: string; snapchat: string };
  blocked: { phones: string[]; ips: string[] };
  content: StoreContent;
  seeded?: boolean;
};

const defaults = (): Settings => ({
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || "",
  phone: process.env.NEXT_PUBLIC_PHONE || "",
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
      whatsapp: d.whatsapp || base.whatsapp, phone: d.phone || base.phone, fees: d.fees || {},
      pixels: {
        facebook: d.pixels?.facebook || base.pixels.facebook,
        tiktok: d.pixels?.tiktok || base.pixels.tiktok,
        snapchat: d.pixels?.snapchat || base.pixels.snapchat,
      },
      blocked: { phones: d.blocked?.phones || [], ips: d.blocked?.ips || [] },
      content: { ...defaultContent, ...(d.content || {}), socials: { ...defaultContent.socials, ...(d.content?.socials || {}) } },
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
