import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/config";
import { discountPercent, isOut, type Product } from "@/lib/catalog";

export default function ProductCard({ p, priority = false }: { p: Product; priority?: boolean }) {
  const off = discountPercent(p);
  return (
    <Link href={`/products/${p.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-square bg-soft">
        <Image src={p.images[0]} alt={p.name} fill sizes="(max-width:768px) 50vw, 25vw" className="object-cover transition duration-300 group-hover:scale-105" priority={priority} />
        {isOut(p) && <span className="absolute inset-x-0 bottom-0 bg-navy/85 py-1.5 text-center text-xs font-bold text-white">نفذ المخزون</span>}
        {p.freeShipping && !isOut(p) && <span className="absolute bottom-2 right-2 rounded-full bg-ok px-2.5 py-1 text-[11px] font-extrabold text-white shadow">🚚 توصيل مجاني</span>}
        {off > 0 && <span className="absolute right-2 top-2 rounded-full bg-sale px-2.5 py-1 text-xs font-bold text-white"><bdi dir="ltr">-{off}%</bdi></span>}
      </div>
      <div className="flex flex-1 flex-col p-3 md:p-4">
        <h3 className="line-clamp-2 text-sm font-bold leading-6 text-navy md:text-base">{p.name}</h3>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-2">
          <span className="text-base font-extrabold text-brand md:text-lg">{formatPrice(p.price)}</span>
          {off > 0 && <span className="text-xs text-muted line-through">{formatPrice(p.compareAtPrice!)}</span>}
        </div>
        <span className="mt-3 rounded-xl bg-navy py-2 text-center text-sm font-bold text-white transition group-hover:bg-brand">اطلب الآن</span>
      </div>
    </Link>
  );
}
