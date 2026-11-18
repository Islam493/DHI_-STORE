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
};

export const statuses = {
  new: { label: "جديدة", color: "bg-brand/10 text-brand" },
  confirmed: { label: "مؤكدة", color: "bg-amber-100 text-amber-700" },
  shipped: { label: "مبعوثة", color: "bg-violet-100 text-violet-700" },
  delivered: { label: "مستلمة", color: "bg-ok/10 text-ok" },
  returned: { label: "راجعة", color: "bg-sale/10 text-sale" },
  cancelled: { label: "ملغية", color: "bg-gray-200 text-gray-600" },
} as const;
export type Status = keyof typeof statuses;

