import { contacts, getSettings } from "@/lib/settings";
import WhatsAppMenu from "./WhatsAppMenu";

export default async function WhatsAppFloat() {
  const c = contacts(await getSettings());
  if (!c.whatsapps.length) return null;
  const text = "السلام عليكم، عندي سؤال على منتج";
  return <WhatsAppMenu items={c.whatsapps.map((w, i) => ({ label: `الدعم ${i + 1}`, n: w.n, href: `${w.href}?text=${encodeURIComponent(text)}` }))} />;
}
