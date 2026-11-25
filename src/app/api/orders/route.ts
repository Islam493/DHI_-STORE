import { NextResponse, after } from "next/server";
import { getSettings } from "@/lib/settings";
import { placeOrder } from "@/lib/checkout";
import { markConverted } from "@/lib/abandoned";
import { notifyTelegram } from "@/lib/orders";
import { onOrderCreated } from "@/lib/automation";

// حماية بسيطة من الطلبات المتكررة: 3 طلبيات كل 10 دقايق لنفس الرقم/IP
const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < 10 * 60_000);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > 3;
}

const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  // فخ للروبوتات (حقل مخفي)
  if (clean(body.website)) return NextResponse.json({ ok: true, id: "0" });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
  const r = await placeOrder({ ...body, product: clean(body.product, 100) }, {
    ip,
    gate: async (o) => {
      // الأرقام والـ IP المحظورين: نرجعو "نجحت" بلا ما نحفظو (المحتال ما يعرفش)
      const { blocked } = await getSettings();
      if (blocked.phones.includes(o.phone) || (ip && blocked.ips.includes(ip))) return { ok: false, status: 200, blocked: true };
      if (limited(`p:${o.phone}`) || (ip && limited(`i:${ip}`))) return { ok: false, status: 429, error: "بعثت بزاف طلبيات. عاود بعد شوية ولا اتصل بينا." };
      return null;
    },
  });

  if (!r.ok) {
    if (r.blocked) return NextResponse.json({ ok: true, id: Date.now().toString(36).toUpperCase(), total: 0 });
    return NextResponse.json(r.errors ? { errors: r.errors } : { error: r.error }, { status: r.status });
  }
  // كلشي آخر يخرج من بعد ما نجاوبو الزبون (صفحة الشكر تبانلو دغيا)
  const draft = clean(body.draft, 40);
  after(async () => {
    await Promise.allSettled([
      notifyTelegram(r.order),
      markConverted(r.order, draft, true), // الطلبية المتروكة (إذا كانت) ولات طلبية حقيقية
      onOrderCreated(r.order), // رسالة التأكيد بالواتساب
    ]);
  });
  return NextResponse.json({ ok: true, id: r.order.id, total: r.order.total });
}
