"use client";
import { useEffect, useState } from "react";
import { api } from "./api";
import { toast } from "./ui";

// تطبيق اللوحة فالتيليفون: التثبيت + تنبيهات الطلبيات (Web Push، بلاش)
type State = "loading" | "unsupported" | "ios" | "off" | "on" | "denied";
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// يتنادى من الهيدر (ديما محلول): نسجلو الـ service worker ونحفظو «نزّل التطبيق» حتى كي تكون القائمة مسكّرة
let deferred: InstallEvent | null = null;
export function usePwaSetup() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin" }).catch(() => {});
    const onPrompt = (e: Event) => { e.preventDefault(); deferred = e as InstallEvent; window.dispatchEvent(new Event("dhi-install")); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
}

const key = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export default function PhoneApp() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setInstall(deferred);
    const onPrompt = () => setInstall(deferred);
    const onInstalled = () => { setInstalled(true); setInstall(null); deferred = null; };
    window.addEventListener("dhi-install", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
        setState(ios && !standalone ? "ios" : "unsupported");
        return;
      }
      const reg = await navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin" });
      if (Notification.permission === "denied") return setState("denied");
      const sub = await reg.pushManager.getSubscription();
      setState(sub && Notification.permission === "granted" ? "on" : "off");
      // نجددو الاشتراك عند السيرفر (إذا تبدّل ولا تفسخ)
      if (sub && Notification.permission === "granted") api("/api/admin/push", { method: "POST", body: JSON.stringify({ subscription: sub.toJSON() }) }).catch(() => {});
    })().catch(() => setState("unsupported"));
    return () => { window.removeEventListener("dhi-install", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const p = await Notification.requestPermission();
      if (p !== "granted") { setState(p === "denied" ? "denied" : "off"); return; }
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await api<{ publicKey: string }>("/api/admin/push");
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(publicKey) });
      await api("/api/admin/push", { method: "POST", body: JSON.stringify({ subscription: sub.toJSON() }) });
      await api("/api/admin/push", { method: "POST", body: JSON.stringify({ subscription: sub.toJSON(), test: true }) });
      setState("on");
      toast("✅ تفعّلت! راهو جاي تنبيه تجربة");
    } catch (e) { toast((e as Error).message || "ما قدرناش نفعّلو التنبيهات", false); }
    finally { setBusy(false); }
  }

  async function test() {
    setBusy(true);
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (!sub) { setState("off"); return; }
      const r = await api<{ ok: boolean }>("/api/admin/push", { method: "POST", body: JSON.stringify({ subscription: sub.toJSON(), test: true }) });
      toast(r.ok ? "تبعث ✅ شوف التنبيه" : "ما وصلش: عاود فعّل التنبيهات", r.ok);
    } catch (e) { toast((e as Error).message, false); }
    finally { setBusy(false); }
  }

  async function doInstall() {
    if (!install) return;
    await install.prompt();
    await install.userChoice.catch(() => null);
    setInstall(null); deferred = null;
  }

  const btn = "rounded-lg px-3 py-1.5 text-xs font-bold";
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-extrabold text-navy">📱 تنبيهات التيليفون (حتى كي يكون مسكّر)</p>
      <div className="flex flex-wrap gap-2">
        {state === "off" && <button onClick={enable} disabled={busy} className={`${btn} bg-brand text-white disabled:opacity-60`}>{busy ? "..." : "🔔 فعّل التنبيهات فهاد الجهاز"}</button>}
        {state === "on" && <>
          <span className={`${btn} bg-green-100 text-green-800`}>✅ هاد الجهاز يوصلو التنبيهات</span>
          <button onClick={test} disabled={busy} className={`${btn} bg-white text-navy ring-1 ring-line disabled:opacity-60`}>جرّب</button>
        </>}
        {state === "denied" && <span className="text-[11px] text-muted">التنبيهات مبلوكية فهاد المتصفح: فعّلها من الإعدادات (🔒 حدا الرابط ← Notifications ← Allow).</span>}
        {state === "unsupported" && <span className="text-[11px] text-muted">هاد المتصفح ما يدعمش التنبيهات. استعمل Chrome.</span>}
        {state === "ios" && <span className="text-[11px] leading-5 text-muted">فالآيفون: اضغط <b>⬆️ مشاركة</b> ← <b>Add to Home Screen</b>، حل التطبيق من الشاشة، ومن بعد فعّل التنبيهات من هنا.</span>}
        {install && !installed && <button onClick={doInstall} className={`${btn} bg-navy text-white`}>📲 نزّل التطبيق</button>}
        {installed && <span className={`${btn} bg-soft text-muted`}>📲 التطبيق مثبّت</span>}
      </div>
    </div>
  );
}
