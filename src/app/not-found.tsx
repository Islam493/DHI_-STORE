import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-6xl">🔍</p>
      <h1 className="mt-4 text-2xl font-extrabold text-navy">الصفحة ما كانتش</h1>
      <Link href="/" className="mt-6 inline-block rounded-2xl bg-brand px-6 py-3 font-bold text-white">رجوع للرئيسية</Link>
    </div>
  );
}
