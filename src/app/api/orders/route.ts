import { NextResponse, after } from "next/server";
import { getSettings } from "@/lib/settings";
import { placeOrder } from "@/lib/checkout";
import { markConverted } from "@/lib/abandoned";
import { notifyTelegram } from "@/lib/orders";
import { sendPush } from "@/lib/push";
import { onOrderCreated } from "@/lib/automation";

// حماية من التكرار: 3 طلبيات كل 10 دقايق لنفس الرقم.
// الـ IP: بزاف تاع الزبائن (موبيليس، جيزي، أوريدو) يتقاسمو نفس الـ IP، علاه الحد واسع
const hits = new Map<string, number[]>();
function limited(key: string, max: number) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < 10 * 60_000);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
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
  if (clean(body.hp)) return NextResponse.json({ ok: true, id: "0" });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
  const r = await placeOrder({ ...body, product: clean(body.product, 100) }, {
    ip,
    gate: async (o) => {
      // الأرقام والـ IP المحظورين: نرجعو "نجحت" بلا ما نحفظو (المحتال ما يعرفش)
      const { blocked } = await getSettings();
      if (blocked.phones.includes(o.phone)) return { ok: false, status: 200, blocked: true };
      // الـ IP المحظور: ما نمسحوش الطلبية (يقدر يكون زبون آخر بنفس الـ IP)، نعلّموها برك
      if (ip && blocked.ips.includes(ip)) o.note = ["⚠️ IP محظور: تأكد مليح قبل ما تبعث", o.note].filter(Boolean).join(" — ");
      if (limited(`p:${o.phone}`, 3) || (ip && limited(`i:${ip}`, 25))) return { ok: false, status: 429, error: "بعثت بزاف طلبيات. عاود بعد شوية ولا اتصل بينا." };
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
      sendPush({ title: `🛒 طلبية جديدة #${r.order.id}`, body: `${r.order.customer_name} — ${r.order.product_name} — ${r.order.total.toLocaleString("en-US")} دج (${r.order.wilaya_name})`, url: `/admin/orders/${r.order.id}`, tag: `order-${r.order.id}` }),
      markConverted(r.order, draft, true), // الطلبية المتروكة (إذا كانت) ولات طلبية حقيقية
      onOrderCreated(r.order), // رسالة التأكيد بالواتساب
    ]);
  });
  return NextResponse.json({ ok: true, id: r.order.id, total: r.order.total });
}
