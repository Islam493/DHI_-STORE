export type Review = {
  id: string;
  created_at: string;
  product_id: string | null; // فارغ = رأي على المتجر كامل
  name: string;
  wilaya: string;
  rating: number; // 1..5
  text: string;
  image: string | null; // سكرين ولا صورة من الزبون (بإذنو)
  order_id: string | null;
  verified: boolean; // صحيح غير إذا الطلبية كاينة وتسلّمت
  visible: boolean;
};

// سكرين برك (رسالة واتساب/تعليق) بلا كلام مكتوب: يبان فمعرض الصور وما يدخلش فحساب النجوم
export const isShot = (r: Review) => !!r.image && !r.text.trim();

export function summarize(all: Review[]) {
  const list = all.filter((r) => !isShot(r));
  const by = [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: list.filter((r) => r.rating === s).length }));
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  return { count: list.length, avg: Math.round(avg * 10) / 10, by };
}
