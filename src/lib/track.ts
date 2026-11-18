// أحداث Facebook Pixel و TikTok Pixel
type W = typeof window & {
  fbq?: (...a: unknown[]) => void;
  ttq?: { track: (e: string, d?: object) => void };
  snaptr?: (...a: unknown[]) => void;
  __px?: { fb: boolean; tt: boolean; sc: boolean };
};


type Ev = "ViewContent" | "InitiateCheckout" | "Purchase";
type Data = { id: string; name: string; value: number; quantity?: number };

// إذا البيكسل مازال ما تشارجاش، نستناوه شوية (حتى 5 ثواني) باش ما يضيعش الحدث
export function track(event: Ev, data: Data, tries = 0) {
  if (typeof window === "undefined") return;
  const w = window as W;
  const px = w.__px || { fb: false, tt: false, sc: false };
  const notReady = (px.fb && !w.fbq) || (px.tt && !w.ttq) || (px.sc && !w.snaptr);
  if (notReady && tries < 25) {
    setTimeout(() => track(event, data, tries + 1), 200);
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
  w.fbq?.("track", event, payload);
  const tt = event === "Purchase" ? "CompletePayment" : event;
  const sc = { ViewContent: "VIEW_CONTENT", InitiateCheckout: "START_CHECKOUT", Purchase: "PURCHASE" }[event];
  w.snaptr?.("track", sc, { item_ids: [data.id], price: data.value, currency: "DZD", number_items: data.quantity ?? 1 });
  w.ttq?.track(tt, { content_id: data.id, content_name: data.name, content_type: "product", value: data.value, currency: "DZD", quantity: data.quantity ?? 1 });
}
