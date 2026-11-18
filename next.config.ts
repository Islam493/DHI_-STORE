import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // صور المنتجات المرفوعة من لوحة التحكم (Supabase Storage)
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
};

export default nextConfig;
