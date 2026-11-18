import Image from "next/image";

export default function Logo({ light = false, size = 40, text = true, compact = false }: { light?: boolean; size?: number; text?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" dir="ltr">
      <Image src="/logo.png" alt="DHI Electronics" width={size} height={size} priority className="shrink-0 rounded-full bg-white shadow-sm" />
      {text && (
        <span className={`whitespace-nowrap font-extrabold tracking-tight ${compact ? "text-base sm:text-lg" : "text-lg"} ${light ? "text-white" : "text-navy"}`}>
          DHI <span className={`font-semibold ${compact ? "hidden min-[380px]:inline" : ""} ${light ? "text-sky-300" : "text-brand"}`}>Electronics</span>
        </span>
      )}
    </span>
  );
}
