// أحداث Facebook Pixel و TikTok Pixel
type W = typeof window & {
  fbq?: (...a: unknown[]) => void;
  ttq?: { track: (e: string, d?: object) => void };
  snaptr?: (...a: unknown[]) => void;
  __px?: { fb: boolean; tt: boolean; sc: boolean };
};


// fbclid (الإعلان اللي جاب الزبون): نحفظوه من أول صفحة، حتى إذا البيكسل مبلوكي
export function keepFbclid() {
  try { const id = new URLSearchParams(location.search).get("fbclid"); if (id) sessionStorage.setItem("fbclid", id.slice(0, 400)); } catch {}
}

// كوكيز فيسبوك (_fbp, _fbc) تتبعث مع الطلبية: السيرفر يربط الطلبية بالإعلان (Conversions API)
export function fbIds() {
  if (typeof document === "undefined") return {};
  const ck = (n: string) => { try { return decodeURIComponent(document.cookie.match(new RegExp(`(?:^|; )${n}=([^;]*)`))?.[1] || ""); } catch { return ""; } };
  let fbc = ck("_fbc");
  if (!fbc) {
    keepFbclid();
    let id: string | null = null;
    try { id = sessionStorage.getItem("fbclid"); } catch {}
    if (id) fbc = `fb.1.${Date.now()}.${id}`;
  }
  return { fbp: ck("_fbp"), fbc, src: location.href.split("#")[0].slice(0, 500) };
}

type Ev = "ViewContent" | "InitiateCheckout" | "Purchase";
type Data = { id: string; name: string; value: number; quantity?: number };

// إذا البيكسل مازال ما تشارجاش، نستناوه شوية (حتى 5 ثواني) باش ما يضيعش الحدث
// eventID: نفس الرقم يتبعث من السيرفر (Conversions API) ← فيسبوك يحسبها مرة وحدة
export function track(event: Ev, data: Data, tries = 0, eventID?: string) {
  if (typeof window === "undefined") return;
  const w = window as W;
  const px = w.__px || { fb: false, tt: false, sc: false };
  const notReady = (px.fb && !w.fbq) || (px.tt && !w.ttq) || (px.sc && !w.snaptr);
  if (notReady && tries < 25) {
    setTimeout(() => track(event, data, tries + 1, eventID), 200);
    return;
  }
  const payload = {
    content_ids: [data.id],
    content_name: data.name,
    content_type: "product",
    value: data.value,
    currency: "DZD",
    num_items: data.quantity ?? 1,
  };
  if (eventID) w.fbq?.("track", event, payload, { eventID });
  else w.fbq?.("track", event, payload);
  const tt = event === "Purchase" ? "CompletePayment" : event;
  const sc = { ViewContent: "VIEW_CONTENT", InitiateCheckout: "START_CHECKOUT", Purchase: "PURCHASE" }[event];
  w.snaptr?.("track", sc, { item_ids: [data.id], price: data.value, currency: "DZD", number_items: data.quantity ?? 1 });
  // تيك توك: الشكل الجديد (contents) + القديم باش يخدمو الزوج
  const qty = data.quantity ?? 1;
  w.ttq?.track(tt, {
    contents: [{ content_id: data.id, content_type: "product", content_name: data.name, quantity: qty, price: Math.round(data.value / qty) }],
    content_id: data.id, content_name: data.name, content_type: "product", value: data.value, currency: "DZD", quantity: qty,
  });
}
