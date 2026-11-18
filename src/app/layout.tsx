import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { store } from "@/lib/config";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(store.url),
  title: { default: `${store.name} — كاميرات المراقبة وأنظمة الحماية في الجزائر`, template: `%s | ${store.name}` },
  description: "كاميرات مراقبة WiFi و 4G بالطاقة الشمسية، كاميرات سرية، إنترفون وأجهزة أمان ذكية. توصيل لـ 58 ولاية والدفع عند الاستلام.",
  openGraph: { siteName: store.name, locale: "ar_DZ", type: "website" },
};

export const viewport: Viewport = { themeColor: "#0b1f3a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
