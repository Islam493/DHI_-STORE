// الطلبات المتروكة: ناس عمّرو الفورميلار (على الأقل الرقم) وما ضغطوش «أكّد الطلبية»
export type CartStatus = "open" | "contacted" | "converted" | "ignored";
export type Cart = {
  id: string;
  created_at: string;
  updated_at: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  variant: string | null;
  quantity: number;
  wilaya_code: number | null;
  wilaya_name: string;
  commune: string;
  delivery_method: "home" | "desk";
  name: string;
  phone: string;
  total: number;
  status: CartStatus;
  order_id: string | null;
  ip: string | null;
  contacted_at?: string | null;
  by?: string | null;
};

export const cartStatuses: Record<CartStatus, { label: string; icon: string; color: string }> = {
  open: { label: "متروكة", icon: "🛍️", color: "bg-amber-100 text-amber-800" },
  contacted: { label: "تواصلنا معاه", icon: "📞", color: "bg-sky-100 text-sky-700" },
  converted: { label: "ولات طلبية", icon: "✅", color: "bg-green-100 text-green-700" },
  ignored: { label: "مهملة", icon: "🙈", color: "bg-gray-200 text-gray-600" },
};
export const isCartStatus = (s: unknown): s is CartStatus => typeof s === "string" && s in cartStatuses;

// تاريخ الرقم: باش نعرفو الزبون المليح من اللي يرجّع ولا يكذب
export type PhoneHistory = { orders: number; delivered: number; returned: number; fake: number; cancelled: number; pending: number };
export const emptyHistory = (): PhoneHistory => ({ orders: 0, delivered: 0, returned: 0, fake: 0, cancelled: 0, pending: 0 });
export function addToHistory(h: PhoneHistory, status: string) {
  h.orders++;
  if (status === "delivered") h.delivered++;
  else if (status === "returned") h.returned++;
  else if (status === "fake") h.fake++;
  else if (["cancelled", "cancelled_client", "duplicate"].includes(status)) h.cancelled++;
  else if (["new", "no_answer", "busy", "postponed", "waiting_client"].includes(status)) h.pending++;
}

// تقييم بسيط وواضح (بلا سحر): أحمر = رجّع ولا كذب قبل، أخضر = استلم قبل
export function riskOf(h: PhoneHistory | undefined): { level: "bad" | "warn" | "good" | "new"; text: string } {
  if (!h || !h.orders) return { level: "new", text: "زبون جديد" };
  if (h.fake || h.returned) {
    const parts = [h.returned && `رجّع ${h.returned}`, h.fake && `مزيف ${h.fake}`, h.delivered && `استلم ${h.delivered}`].filter(Boolean);
    return { level: h.returned + h.fake > h.delivered ? "bad" : "warn", text: parts.join(" · ") };
  }
  if (h.delivered) return { level: "good", text: `استلم ${h.delivered} قبل` };
  if (h.cancelled >= 2) return { level: "warn", text: `ألغى ${h.cancelled}` };
  return { level: "new", text: h.orders > 1 ? `${h.orders} طلبيات` : "زبون جديد" };
}
export const riskColor = { bad: "bg-red-100 text-red-700", warn: "bg-amber-100 text-amber-800", good: "bg-green-100 text-green-700", new: "bg-soft text-muted" } as const;
