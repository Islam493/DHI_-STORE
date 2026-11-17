// أحداث Facebook Pixel و TikTok Pixel
type W = typeof window & {
  fbq?: (...a: unknown[]) => void;
  ttq?: { track: (e: string, d?: object) => void };
};

export function track(event: "ViewContent" | "InitiateCheckout" | "Purchase", data: { id: string; name: string; value: number; quantity?: number }) {
  if (typeof window === "undefined") return;
  const w = window as W;
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
  w.ttq?.track(tt, { content_id: data.id, content_name: data.name, content_type: "product", value: data.value, currency: "DZD", quantity: data.quantity ?? 1 });
}
