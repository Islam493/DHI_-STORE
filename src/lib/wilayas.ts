// الولايات الـ 58 وأسعار التوصيل.
// ⚠️ الأسعار هنا مؤقتة (تقديرية) — بدّلها بالأسعار الحقيقية تاع شركة التوصيل تاعك.
// home = توصيل للدار، desk = استلام من المكتب (null = ما كانش مكتب)
export type Wilaya = { code: number; name: string; home: number; desk: number | null };

const Z = {
  algiers: { home: 400, desk: 300 },
  north: { home: 700, desk: 450 },
  high: { home: 800, desk: 500 },
  south: { home: 1100, desk: 700 },
  far: { home: 1500, desk: null as number | null },
};

const list: [number, string, keyof typeof Z][] = [
  [1, "أدرار", "south"], [2, "الشلف", "north"], [3, "الأغواط", "high"], [4, "أم البواقي", "high"],
  [5, "باتنة", "high"], [6, "بجاية", "north"], [7, "بسكرة", "high"], [8, "بشار", "south"],
  [9, "البليدة", "north"], [10, "البويرة", "north"], [11, "تمنراست", "far"], [12, "تبسة", "high"],
  [13, "تلمسان", "north"], [14, "تيارت", "high"], [15, "تيزي وزو", "north"], [16, "الجزائر", "algiers"],
  [17, "الجلفة", "high"], [18, "جيجل", "north"], [19, "سطيف", "high"], [20, "سعيدة", "high"],
  [21, "سكيكدة", "north"], [22, "سيدي بلعباس", "north"], [23, "عنابة", "north"], [24, "قالمة", "north"],
  [25, "قسنطينة", "north"], [26, "المدية", "north"], [27, "مستغانم", "north"], [28, "المسيلة", "high"],
  [29, "معسكر", "north"], [30, "ورقلة", "south"], [31, "وهران", "north"], [32, "البيض", "high"],
  [33, "إليزي", "far"], [34, "برج بوعريريج", "high"], [35, "بومرداس", "north"], [36, "الطارف", "north"],
  [37, "تندوف", "far"], [38, "تيسمسيلت", "high"], [39, "الوادي", "south"], [40, "خنشلة", "high"],
  [41, "سوق أهراس", "north"], [42, "تيبازة", "north"], [43, "ميلة", "north"], [44, "عين الدفلى", "north"],
  [45, "النعامة", "high"], [46, "عين تموشنت", "north"], [47, "غرداية", "south"], [48, "غليزان", "north"],
  [49, "تيميمون", "south"], [50, "برج باجي مختار", "far"], [51, "أولاد جلال", "high"], [52, "بني عباس", "south"],
  [53, "عين صالح", "far"], [54, "عين قزام", "far"], [55, "تقرت", "south"], [56, "جانت", "far"],
  [57, "المغير", "south"], [58, "المنيعة", "south"],
];

export const wilayas: Wilaya[] = list.map(([code, name, z]) => ({ code, name, ...Z[z] }));

export function getWilaya(code: number) {
  return wilayas.find((w) => w.code === code);
}

export function shippingFee(code: number, method: "home" | "desk") {
  const w = getWilaya(code);
  if (!w) return null;
  return method === "desk" ? w.desk : w.home;
}
