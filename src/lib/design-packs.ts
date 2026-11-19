import packs from "@/data/design-packs.json";

// تصاميم DHI لكل منتج: صور (تبان فالكروت) + فيديو موشن لكل صورة (يتلعب فصفحة المنتج)
// spin: صور 360° الحقيقية (dir/01.webp ... dir/NN.webp) من فيديو المنتج وهو يدور
export type DesignPack = { images: string[]; videos?: string[]; photo: string; legacy?: string[]; spin?: { dir: string; count: number; reverse?: boolean } };
export const designPacks = packs as Record<string, DesignPack>;

const upgrade = new Map<string, string>();
const video = new Map<string, string>();
for (const p of Object.values(designPacks)) {
  // النسخة القديمة تتبدل وحدها بالجديدة (نفس الترتيب) بلا ما تعاود تحفظ المنتج
  p.legacy?.forEach((u, k) => p.images[k] && upgrade.set(u, p.images[k]));
  p.videos?.forEach((v, k) => p.images[k] && video.set(p.images[k], v));
}

export const upgradeImages = (list: string[]) => list.map((u) => upgrade.get(u) || u);
export const videoFor = (img: string) => video.get(img);

export function spinFor(slug: string) {
  const s = designPacks[slug]?.spin;
  if (!s || s.count < 8) return undefined;
  return { frames: Array.from({ length: s.count }, (_, k) => `${s.dir}/${String(k + 1).padStart(2, "0")}.webp`), reverse: s.reverse };
}

// صورة قسم الموشن: الكاميرا الحقيقية مقطوعة، كي التصاميم مستعملين
export function motionPhoto(slug: string, images: string[]) {
  const pack = designPacks[slug];
  return pack && images.some((i) => pack.images.includes(i)) ? pack.photo : images[1] || images[0];
}
