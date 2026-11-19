import packs from "@/data/design-packs.json";

// تصاميم DHI لكل منتج: صور (تبان فالكروت) + فيديو موشن لكل صورة (يتلعب فصفحة المنتج)
export type DesignPack = { images: string[]; videos?: string[]; photo: string; legacy?: string[] };
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

// صورة قسم الموشن: الكاميرا الحقيقية مقطوعة، كي التصاميم مستعملين
export function motionPhoto(slug: string, images: string[]) {
  const pack = designPacks[slug];
  return pack && images.some((i) => pack.images.includes(i)) ? pack.photo : images[1] || images[0];
}
