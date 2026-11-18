"use client";
// نداء للـ API تاع اللوحة: يرجع JSON ولا يرمي الغلطة بالعربية
export async function api<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: init?.body instanceof FormData ? init?.headers : { "Content-Type": "application/json", ...init?.headers } });
  if (res.status === 401) {
    window.location.href = "/admin/login";
    throw new Error("لازم تدخل");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "صرا مشكل");
  return data as T;
}

export const fmt = (n: number) => `${n.toLocaleString("en-US")} دج`;

export function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "دروك";
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.floor(h / 24);
  if (d < 7) return `قبل ${d} يوم`;
  return new Date(iso).toLocaleDateString("fr-DZ");
}
