// رسائل واتساب جاهزة (تخرج من الواتساب العادي تاعك بكليك، بلاش)
import type { Order } from "./order-types";

const fmt = (n: number) => `${n.toLocaleString("en-US")} دج`;
const first = (o: Order) => o.customer_name.trim().split(/\s+/)[0] || o.customer_name;
const product = (o: Order) => `${o.product_name}${o.variant ? ` (${o.variant})` : ""}${o.quantity > 1 ? ` × ${o.quantity}` : ""}`;
const place = (o: Order) => `${o.wilaya_name}${o.commune ? ` — ${o.commune}` : ""} (${o.delivery_method === "desk" ? "المكتب" : "الدار"})`;
export const trackUrl = (t: string) => `https://suivi.ecotrack.dz/suivi/${encodeURIComponent(t)}`;

export type MsgKind = "confirm" | "reminder" | "shipped" | "ofd" | "missed" | "delivered";

export const msgLabels: Record<MsgKind, string> = {
  confirm: "رسالة التأكيد", reminder: "ما لقيناكش", shipped: "خرجت", ofd: "الليفرور جاي", missed: "ما لقاكش الليفرور", delivered: "شكراً + رأيك",
};

export function waText(kind: MsgKind, o: Order) {
  const hi = `السلام عليكم ${first(o)}`;
  switch (kind) {
    case "confirm":
      return `${hi} 👋\nمعاك فريق DHI Electronics، وصلتنا طلبيتك:\n📦 ${product(o)}\n💵 المجموع: ${fmt(o.total)} (الدفع عند الاستلام)\n📍 ${place(o)}\n\nنأكدو الطلبية باش نبعثوهالك؟ ✅\nجاوبنا بـ «نعم»، ولا إذا عندك أي سؤال اكتبهولنا 🙏`;
    case "reminder":
      return `${hi} 🙏\nعيّطنالك وما لقيناكش. طلبيتك (${product(o)}) مازالت تستنى التأكيد.\nجاوبنا بـ «نعم» باش نبعثوهالك، ولا قولنا الوقت اللي يناسبك ونعيطولك.`;
    case "shipped":
      return `${hi} 🚚\nطلبيتك (${product(o)}) خرجت مع شركة التوصيل.${o.tracking ? `\n🔢 رقم التتبع: ${o.tracking}\n🔗 تتبّعها هنا: ${trackUrl(o.tracking)}` : ""}\n💵 حضّر ${fmt(o.total)} وخلّي تيليفونك مفتوح باش الليفرور يلقاك.\nشكراً على ثقتك 🙏`;
    case "ofd":
      return `${hi} 📦\nطلبيتك (${product(o)}) راهي مع الليفرور ووصولها قريب.\nخلّي تيليفونك مفتوح وحضّر ${fmt(o.total)}. شكراً 🙏`;
    case "missed":
      return `${hi}،\nالليفرور حاول يوصلك طلبيتك (${product(o)}) وما قدرش يتصل بيك 📵\nقولنا الوقت اللي يناسبك ولا عيّطلنا، باش نعاودو نبرمجو التوصيل قبل ما ترجع الطلبية.`;
    case "delivered":
      return `${hi} 🎉\nنتمناو طلبيتك (${product(o)}) عجبتك! شكراً على ثقتك فـ DHI Electronics.\nإذا احتجت مساعدة فالتركيب ولا الاستعمال راحنا هنا 🤝\nويسعدنا تبعثلنا رأيك ولا صورة للمنتج عندك ⭐`;
  }
}

// يحل الواتساب تاعك (الرقم اللي راك داخل بيه فالتيليفون ولا WhatsApp Web) والرسالة مكتوبة
export const waUrl = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, "").replace(/^0/, "213")}?text=${encodeURIComponent(text)}`;
export const waFor = (kind: MsgKind, o: Order) => waUrl(o.phone, waText(kind, o));
