import packs from "@/data/design-packs.json";

// صور المنتجات: 4 تصاميم بنفس الستيل (الأولى = الإعلان الأصلي) + فيديو موشن لكل وحدة
type Pack = { images: string[]; videos: string[]; photo: string };
type Packs = { restore: Record<string, string[]>; packs: Record<string, Pack>; spin?: Record<string, { dir: string; count: number; reverse?: boolean }> };
const P = packs as Packs;

const video = new Map<string, string>();
for (const p of Object.values(P.packs)) p.videos.forEach((v, k) => p.images[k] && video.set(p.images[k], v));

// المنتج اللي مازال بصورو الأصلية (ولا بالتصاميم القدام) ياخذ الـ 4 تصاميم وحدو.
// إذا صاحب المتجر بدّل الصور من اللوحة، نخليو صورو كيما هوما.
export function packImages(slug: string, list: string[]) {
  const pack = P.packs[slug];
  const orig = P.restore[slug] || [];
  const clean = list.filter((u) => !u.startsWith("/designs/"));
  const untouched = !clean.length || clean.every((u) => orig.includes(u) || u.startsWith("/products/" + slug + "-"));
  if (pack && untouched) return [...pack.images];
  return clean.length ? clean : orig;
}

export const videoFor = (img: string) => video.get(img);

export function spinFor(slug: string) {
  const s = P.spin?.[slug];
  if (!s || s.count < 8) return undefined;
  return { frames: Array.from({ length: s.count }, (_, k) => `${s.dir}/${String(k + 1).padStart(2, "0")}.webp`), reverse: s.reverse };
}

// قسم الموشن: المنتج مقطوع على خلفية المتجر
export function motionPhoto(slug: string, images: string[]) {
  const pack = P.packs[slug];
  return pack && images.some((i) => pack.images.includes(i)) ? pack.photo : images[0];
}
