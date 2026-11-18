// أنواع الطلبيات وحالاتها (يستعملهم المتصفح والسيرفر)
export type Order = {
  id: string;
  created_at: string;
  status: string;
  customer_name: string;
  phone: string;
  wilaya_code: number;
  wilaya_name: string;
  commune: string;
  address: string;
  delivery_method: "home" | "desk";
  product_id: string;
  product_name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
  shipping_fee: number;
  total: number;
  note: string;
  ip: string | null;
  tracking?: string | null; // رقم التتبع عند شركة التوصيل
  shipped_at?: string | null;
  history?: { s: string; at: string; by?: string }[] | null; // تاريخ الحالات
  internal_note?: string | null; // ملاحظة داخلية (للفريق برك)
  stock_applied?: boolean | null;
  updated_at?: string | null;
};

// الحالات (بنفس ترتيب العمل: اتصال ← تأكيد ← توصيل)
export const statuses = {
  new: { label: "جديدة", icon: "🆕", color: "bg-sky-100 text-sky-700" },
  no_answer: { label: "لم يرد على الاتصال", icon: "📵", color: "bg-orange-100 text-orange-700" },
  busy: { label: "الخط مشغول", icon: "📞", color: "bg-orange-100 text-orange-700" },
  postponed: { label: "مؤجلة", icon: "📅", color: "bg-amber-100 text-amber-700" },
  waiting_client: { label: "في انتظار اتصال العميل", icon: "⏳", color: "bg-amber-100 text-amber-700" },
  confirmed: { label: "مؤكدة", icon: "✅", color: "bg-teal-100 text-teal-700" },
  preparing: { label: "قيد التحضير", icon: "📦", color: "bg-indigo-100 text-indigo-700" },
  ready: { label: "جاهزة للإرسال", icon: "🏷️", color: "bg-blue-100 text-blue-700" },
  shipped: { label: "عند شركة التوصيل", icon: "🚚", color: "bg-violet-100 text-violet-700" },
  delivered: { label: "مكتملة", icon: "🎉", color: "bg-green-100 text-green-700" },
  returned: { label: "مرجع", icon: "↩️", color: "bg-red-100 text-red-700" },
  cancelled: { label: "ملغاة", icon: "❌", color: "bg-gray-200 text-gray-600" },
  cancelled_client: { label: "ملغاة من قبل العميل", icon: "🙅", color: "bg-gray-200 text-gray-600" },
  fake: { label: "مزيف", icon: "⚠️", color: "bg-red-100 text-red-800" },
  duplicate: { label: "مكرر", icon: "📑", color: "bg-gray-200 text-gray-600" },
} as const;
export type Status = keyof typeof statuses;

export const groups = {
  pending: ["new", "no_answer", "busy", "postponed", "waiting_client"] as Status[],
  confirmed: ["confirmed", "preparing", "ready", "shipped", "delivered", "returned"] as Status[],
  cancelled: ["cancelled", "cancelled_client", "fake", "duplicate"] as Status[],
};

export const isStatus = (s: unknown): s is Status => typeof s === "string" && s in statuses;

// الحالات اللي تطلب تأكيد قبل التبديل
export const needsConfirm: Status[] = ["cancelled", "cancelled_client", "fake", "duplicate", "returned", "delivered"];
