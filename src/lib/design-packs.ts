import packs from "@/data/design-packs.json";

// صور المنتجات = الإعلانات اللي صممهم صاحب المتجر، كيما هوما (بلا قص وبلا تبديل)
type Packs = { restore: Record<string, string[]>; extra?: Record<string, string[]>; spin?: Record<string, { dir: string; count: number; reverse?: boolean }> };
const P = packs as Packs;

export function packImages(slug: string, list: string[]) {
  // التصاميم القدام (/designs/) تتنحاو، وإذا ما بقا والو نرجعو للإعلان الأصلي
  const clean = list.filter((u) => !u.startsWith("/designs/"));
  const base = clean.length ? clean : P.restore[slug] || [];
  const orig = P.restore[slug] || [];
  const untouched = base.length === orig.length && base.every((u, k) => u === orig[k]);
  const extra = untouched ? (P.extra?.[slug] || []).filter((u) => !base.includes(u)) : [];
  return [...base, ...extra];
}

export const videoFor = (_img: string): string | undefined => undefined;

export function spinFor(slug: string) {
  const s = P.spin?.[slug];
  if (!s || s.count < 8) return undefined;
  return { frames: Array.from({ length: s.count }, (_, k) => `${s.dir}/${String(k + 1).padStart(2, "0")}.webp`), reverse: s.reverse };
}

// قسم الموشن: الإعلان الأول تاع المنتج
export const motionPhoto = (_slug: string, images: string[]) => images[0];
