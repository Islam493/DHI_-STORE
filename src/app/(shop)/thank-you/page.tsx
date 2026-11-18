import type { Metadata } from "next";
import { Suspense } from "react";
import ThankYou from "./ThankYou";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "شكرا على طلبيتك", robots: { index: false } };

export default async function Page() {
  const { whatsapp } = await getSettings();
  return <Suspense><ThankYou whatsapp={whatsapp} /></Suspense>;
}
