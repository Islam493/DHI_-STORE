// تطبيق لوحة التحكم: يستقبل تنبيهات الطلبيات حتى كي يكون التيليفون مسكّر
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: "DHI", body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(d.title || "DHI Electronics", {
    body: d.body || "",
    icon: "/app/icon-192.png",
    badge: "/app/badge.png",
    tag: d.tag || undefined,
    renotify: Boolean(d.tag),
    data: { url: d.url || "/admin" },
    dir: "rtl",
    lang: "ar",
    vibrate: [200, 100, 200],
  }));
});

// الضغط على التنبيه: يحل الطلبية (ولا يرجع للتطبيق إذا راهو محلول)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/admin", self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.location.origin + "/admin") && "focus" in c) { await c.focus(); if ("navigate" in c) await c.navigate(url).catch(() => {}); return; }
    }
    await self.clients.openWindow(url);
  })());
});
