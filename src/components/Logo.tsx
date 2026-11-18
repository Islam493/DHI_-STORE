import Image from "next/image";

export default function Logo({ light = false, size = 40, text = true }: { light?: boolean; size?: number; text?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" dir="ltr">
      <Image src="/logo.png" alt="DHI Electronics" width={size} height={size} priority className="shrink-0 rounded-full bg-white shadow-sm" />
      {text && (
        <span className={`text-lg font-extrabold tracking-tight ${light ? "text-white" : "text-navy"}`}>
          DHI <span className={`font-semibold ${light ? "text-sky-300" : "text-brand"}`}>Electronics</span>
        </span>
      )}
    </span>
  );
}
