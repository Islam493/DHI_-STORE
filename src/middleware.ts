import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, readSession } from "@/lib/auth";
import shopify from "@/data/shopify-redirects.json";

// روابط شوبيفاي القدام (الإعلانات، البوستات، جوجل) → الصفحة الصحيحة فالمتجر الجديد
const OLD = new Map(Object.entries(shopify as Record<string, string>).map(([k, v]) => [k.normalize("NFC").toLowerCase(), v]));
const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
const oldProduct = (handle: string) => OLD.get(decode(handle).normalize("NFC").toLowerCase());

function legacy(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const to = (path: string) => {
    const url = req.nextUrl.clone();
    url.pathname = path;
    url.search = req.nextUrl.search; // نخليو utm_… تاع الإعلانات
    return NextResponse.redirect(url, 301);
  };
  // /products/<handle> و /collections/<x>/products/<handle>
  const pi = parts.indexOf("products");
  if (pi >= 0 && parts[pi + 1]) {
    const slug = oldProduct(parts[pi + 1]);
    if (slug) return to(`/products/${slug}`);
    if (pi === 0) return NextResponse.next(); // رابط جديد عادي
  }
  if (parts[0] === "collections") return to("/search");
  if (parts[0] === "pages") return to(parts[1]?.includes("contact") ? "/contact" : "/");
  if (parts[0] === "policies") return to(/refund|return/.test(parts[1] || "") ? "/policies/returns" : /shipping/.test(parts[1] || "") ? "/policies/shipping" : "/");
  if (["cart", "account", "checkouts", "checkout"].includes(parts[0])) return to("/");
  return NextResponse.next();
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) return legacy(req);
  if (pathname === "/admin/login" || pathname === "/api/admin/login") return NextResponse.next();
  if (await readSession(req.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "لازم تدخل" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/products/:path*", "/collections/:path*", "/pages/:path*", "/policies/:path*", "/cart", "/cart/:path*", "/account/:path*", "/checkouts/:path*", "/checkout"],
};
