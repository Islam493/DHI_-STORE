import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { dbSelect } from "@/lib/db";
import { defaultAutomation, getSettings, saveSettings, type Automation } from "@/lib/settings";
import { TEMPLATES, VERIFY_TOKEN, sendTemplate, wa } from "@/lib/whatsapp";
import { tick } from "@/lib/automation";
import { carrier, trackingStatus } from "@/lib/ecotrack";
import { store } from "@/lib/config";
import { actor, fail, guard } from "@/lib/admin-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const g = await guard("settings.edit"); if (g) return g;
  try {
    const s = await getSettings(true);
    let messages: unknown[] = [];
    let ready = true;
    try { messages = await dbSelect("wa_messages", { order: ["at", "desc"], limit: 60 }, { fresh: true }); }
    catch { ready = false; }
    return NextResponse.json({
      ready,
      wa: { enabled: wa.enabled, webhook: wa.webhook, verify: Boolean(VERIFY_TOKEN) },
      carrier: carrier.enabled,
      cron: Boolean(process.env.CRON_SECRET?.trim()),
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      webhookUrl: `${store.url}/api/whatsapp/webhook`,
      cronUrl: `${store.url}/api/cron/automation?key=`,
      automation: s.automation,
      templates: Object.entries(TEMPLATES).map(([name, t]) => ({ name, text: t.text, buttons: t.buttons, vars: t.vars })),
      messages,
    });
  } catch (e) { return fail(e); }
}

const hours = (v: unknown, d: number, min: number, max: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : d; };

export async function PUT(req: Request) {
  const g = await guard("settings.edit"); if (g) return g;
  const b = await req.json().catch(() => ({}));
  const a: Automation = {
    confirm: b.confirm !== false,
    reminderHours: hours(b.reminderHours, defaultAutomation.reminderHours, 1, 48),
    noAnswerHours: hours(b.noAnswerHours, defaultAutomation.noAnswerHours, 2, 120),
    autoShip: b.autoShip === true,
    tracking: b.tracking !== false,
    messages: b.messages !== false,
  };
  if (a.noAnswerHours <= a.reminderHours) a.noAnswerHours = a.reminderHours + 1;
  try {
    await saveSettings({ automation: a });
    await audit(await actor(), "automation.save", "", a);
    return NextResponse.json({ ok: true, automation: a });
  } catch (e) { return fail(e); }
}

// أدوات التجربة: رسالة تجربة، قراءة تتبع طرد، تشغيل الدورة دركا
export async function POST(req: Request) {
  const g = await guard("settings.edit"); if (g) return g;
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === "test") {
      const phone = String(b.phone || "").replace(/[\s.-]/g, "").replace(/^(\+213|00213)/, "0");
      if (!/^0[567]\d{8}$/.test(phone)) return NextResponse.json({ error: "رقم الهاتف غالط" }, { status: 400 });
      if (!wa.enabled) return NextResponse.json({ error: "الواتساب مازال ما تربطش: زيد المفاتيح فـ Vercel" }, { status: 409 });
      const id = await sendTemplate(phone, "dhi_confirm", ["تجربة", "كاميرا (تجربة)", "0 دج", "الجزائر (الدار)"], { payloads: ["TEST:0", "TEST:0"] });
      if (!id) {
        const [last] = await dbSelect<{ error?: string }>("wa_messages", { eq: { phone }, order: ["at", "desc"], limit: 1 }, { fresh: true }).catch(() => []);
        return NextResponse.json({ error: `ما خرجتش: ${last?.error || "شوف القالب dhi_confirm واش تقبل فـ WhatsApp Manager"}` }, { status: 400 });
      }
      return NextResponse.json({ ok: true, id });
    }
    if (b.action === "track") {
      if (!carrier.enabled) return NextResponse.json({ error: "World Express ما راهيش مربوطة" }, { status: 409 });
      const t = await trackingStatus(String(b.tracking || "").trim());
      return NextResponse.json({ ok: true, label: t.label, state: t.state, raw: t.raw });
    }
    if (b.action === "tick") return NextResponse.json({ ok: true, result: await tick() });
    return NextResponse.json({ error: "أمر غير معروف" }, { status: 400 });
  } catch (e) { return fail(e); }
}
