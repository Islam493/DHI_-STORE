import type { Metadata, Viewport } from "next";

// اللوحة تتثبّت كيما تطبيق فالتيليفون (manifest + أيقونة)
export const metadata: Metadata = {
  title: "لوحة التحكم",
  robots: { index: false, follow: false },
  manifest: "/admin-manifest.webmanifest",
  appleWebApp: { capable: true, title: "DHI Admin", statusBarStyle: "black-translucent" },
  icons: { apple: "/app/icon-192.png" },
};
export const viewport: Viewport = { themeColor: "#0b1f3a" };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-soft">{children}</div>;
}
