"use client";
import { api } from "./api";

// نصغرو الصورة فالتيليفون قبل ما نرفعوها
export async function shrink(file: File, max = 1600): Promise<Blob> {
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return file;
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob((b) => r(b || file), "image/webp", 0.85));
}

export async function uploadFile(file: File): Promise<string> {
  const blob = await shrink(file);
  const fd = new FormData();
  fd.append("file", blob, file.name.replace(/\.[^.]+$/, "") + (blob.type === "image/webp" ? ".webp" : ".jpg"));
  return (await api<{ url: string }>("/api/admin/upload", { method: "POST", body: fd })).url;
}
