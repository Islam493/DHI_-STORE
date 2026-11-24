import { NextResponse } from "next/server";
import { dbSelect } from "@/lib/db";
import type { Order } from "@/lib/order-types";
import { getStates, logContact } from "@/lib/automation";
import { phoneInsights } from "@/lib/abandoned";
import { actor, fail, guard } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

const TABS = {
  confirm: ["new", "no_answer", "busy", "postponed", "waiting_client"],
  shipping: ["ready", "shipped"],
  delivered: ["delivered"],
} as const;
type Tab = keyof typeof TABS;

// صفحة التأكيد والمتابعة: الطلبيات اللي تستنى، اللي فالطريق، واللي وصلو
export async function GET(req: Request) {
  const g = await guard("orders.view"); if (g) return g;
  const t = new URL(req.url).searchParams.get("tab") as Tab;
  const tab: Tab = t in TABS ? t : "confirm";
  try {
    const since = new Date(Date.now() - (tab === "delivered" ? 10 : tab === "confirm" ? 21 : 60) * 86400_000).toISOString();
    const [rows, ...counts] = await Promise.all([
      dbSelect<Order>("orders", { in: { status: [...TABS[tab]] }, gte: { created_at: since }, order: ["created_at", tab === "delivered" ? "desc" : "asc"], limit: 150 }, { fresh: true }),
      ...(Object.keys(TABS) as Tab[]).map((k) => dbSelect<Order>("orders", { in: { status: [...TABS[k]] }, gte: { created_at: new Date(Date.now() - (k === "delivered" ? 10 : k === "confirm" ? 21 : 60) * 86400_000).toISOString() }, select: "id", limit: 1000 }, { fresh: true }).then((r) => [k, r.length] as const)),
    ]);
    const [states, insights] = await Promise.all([getStates(rows.map((o) => o.id)), phoneInsights(rows.map((o) => o.phone)).catch(() => ({ history: {}, dups: {} }))]);
    return NextResponse.json({
      tab, counts: Object.fromEntries(counts),
      orders: rows.map((o) => ({ ...o, auto: states[o.id] || null })),
      history: insights.history, dups: insights.dups,
    });
  } catch (e) { return fail(e); }
}

// تسجيل: عيّط ولا بعث رسالة
export async function POST(req: Request) {
  const g = await guard("orders.edit"); if (g) return g;
  const { id, kind } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || !/^(call|confirm|reminder|shipped|ofd|missed|delivered)$/.test(String(kind))) return NextResponse.json({ error: "معلومات غالطة" }, { status: 400 });
  try { return NextResponse.json({ ok: true, ...(await logContact(id, kind, await actor())) }); }
  catch (e) { return fail(e); }
}
