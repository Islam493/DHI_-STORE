"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/config";

type Mini = { slug: string; name: string; image: string; price: number };
const KEY = "dhi:recent";

// المنتجات اللي شافهم الزبون قبل (محفوظة فالتيليفون تاعو برك)
export default function RecentlyViewed({ current, all }: { current: string; all: Mini[] }) {
  const [list, setList] = useState<Mini[]>([]);
  useEffect(() => {
    let slugs: string[] = [];
    try { slugs = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch {}
    setList(slugs.filter((s) => s !== current).map((s) => all.find((p) => p.slug === s)).filter(Boolean).slice(0, 4) as Mini[]);
    try { localStorage.setItem(KEY, JSON.stringify([current, ...slugs.filter((s) => s !== current)].slice(0, 10))); } catch {}
  }, [current, all]);
  if (!list.length) return null;
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-xl font-extrabold text-navy">👀 شفتهم مؤخرا</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {list.map((p) => (
          <Link key={p.slug} href={`/products/${p.slug}`} className="flex items-center gap-3 rounded-2xl bg-white p-2 ring-1 ring-line hover:ring-brand">
            <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-soft"><Image src={p.image} alt="" fill sizes="56px" className="object-cover" /></span>
            <span className="min-w-0"><span className="line-clamp-2 text-xs font-bold text-navy">{p.name}</span><span className="text-xs font-extrabold text-brand">{formatPrice(p.price)}</span></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
