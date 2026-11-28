import { NextResponse } from "next/server";
import { fail, guard, actor, refreshSite } from "@/lib/admin-api";
import { getSettings, saveSettings, defaultSocial, type Social } from "@/lib/settings";
import { ai, answer, MODEL, type Turn } from "@/lib/social/brain";
import { getKnowledge } from "@/lib/social/knowledge";
import { meta } from "@/lib/social/meta";
import { FOREVER, getThread, listThreads, saveThread, socialReady, socialStats, threadMessages } from "@/lib/social/bot";
import { store } from "@/lib/config";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// الحالة + الإعدادات + المحادثات (ولا رسائل محادثة وحدة: ?thread=...)
export async function GET(req: Request) {
  const g = await guard("settings.edit"); if (g) return g;
  try {
    const id = new URL(req.url).searchParams.get("thread");
    if (id) return NextResponse.json({ thread: await getThread(id), messages: await threadMessages(id) });
    const [s, ready, k] = await Promise.all([getSettings(true), socialReady(), getKnowledge(true)]);
    return NextResponse.json({
      social: s.social, ready,
      keys: { ai: ai.enabled, send: meta.send, webhook: meta.webhook, instagram: meta.instagram },
      model: MODEL(),
      webhookUrl: `${store.url}/api/meta/webhook`,
      products: k.products,
      stats: ready ? await socialStats() : null,
      threads: ready ? await listThreads() : [],
    });
  } catch (e) { return fail(e); }
}

// حفظ الإعدادات
export async function PUT(req: Request) {
  const g = await guard("settings.edit"); if (g) return g;
  try {
    const b = (await req.json().catch(() => ({}))) as Partial<Social>;
    const cur = (await getSettings(true)).social;
    const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    const social: Social = {
      enabled: bool(b.enabled, cur.enabled), dm: bool(b.dm, cur.dm), comments: bool(b.comments, cur.comments),
      publicReply: bool(b.publicReply, cur.publicReply), privateReply: bool(b.privateReply, cur.privateReply),
      humanHours: Math.min(168, Math.max(1, Math.round(Number(b.humanHours) || defaultSocial.humanHours))),
      note: String(b.note ?? cur.note).slice(0, 1500),
    };
    await saveSettings({ social });
    refreshSite("settings");
    await audit(await actor(), "social.settings", null, { enabled: social.enabled, dm: social.dm, comments: social.comments });
    return NextResponse.json({ ok: true, social });
  } catch (e) { return fail(e); }
}

// test = جرّب الروبوت (ما يبعث والو لـ Meta) — pause/resume/done = محادثة وحدة
export async function POST(req: Request) {
  const g = await guard("settings.edit"); if (g) return g;
  try {
    const b = await req.json().catch(() => ({}));
    if (b.action === "test") {
      const text = String(b.text || "").trim().slice(0, 1000);
      if (!text) return NextResponse.json({ error: "اكتب رسالة" }, { status: 400 });
      const history = (Array.isArray(b.history) ? b.history : []).slice(-12)
        .map((t: Turn) => ({ from: t?.from === "bot" ? "bot" : "customer", text: String(t?.text || "").slice(0, 1000) })) as Turn[];
      const r = await answer({ channel: b.channel === "instagram" ? "instagram" : "facebook", kind: b.kind === "comment" ? "comment" : "dm", text, name: String(b.name || "").slice(0, 60), history });
      return NextResponse.json(r);
    }
    const id = String(b.thread || "");
    if (!id) return NextResponse.json({ error: "المحادثة ناقصة" }, { status: 400 });
    if (b.action === "pause") await saveThread({ id, paused_until: FOREVER });
    else if (b.action === "resume") await saveThread({ id, paused_until: null, needs_human: false });
    else if (b.action === "done") await saveThread({ id, needs_human: false });
    else return NextResponse.json({ error: "عملية ما نعرفهاش" }, { status: 400 });
    return NextResponse.json({ ok: true, thread: await getThread(id) });
  } catch (e) { return fail(e); }
}
