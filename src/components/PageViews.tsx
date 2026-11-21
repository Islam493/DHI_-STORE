"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type W = typeof window & { fbq?: (...a: unknown[]) => void; ttq?: { page?: () => void }; snaptr?: (...a: unknown[]) => void };

// كي الزبون يتنقل فالموقع بلا إعادة تحميل، نبعثو PageView جديد لفيسبوك وتيك توك
export default function PageViews() {
  const path = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; } // الأولى تتبعث مع البيكسل
    const w = window as W;
    w.fbq?.("track", "PageView");
    w.ttq?.page?.();
    w.snaptr?.("track", "PAGE_VIEW");
  }, [path]);
  return null;
}
