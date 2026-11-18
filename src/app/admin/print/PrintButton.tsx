"use client";
export default function PrintButton() {
  return <button onClick={() => window.print()} className="rounded-xl bg-brand px-5 py-2.5 font-bold text-white">🖨️ اطبع</button>;
}
