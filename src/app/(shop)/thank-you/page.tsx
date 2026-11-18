import type { Metadata } from "next";
import { Suspense } from "react";
import ThankYou from "./ThankYou";
import { getSettings } from "@/lib/settings";
import ContactBlock from "@/components/ContactBlock";

export const metadata: Metadata = { title: "شكرا على طلبيتك", robots: { index: false } };

export default async function Page() {
  const { whatsapp } = await getSettings();
  return (
    <>
      <Suspense><ThankYou whatsapp={whatsapp} /></Suspense>
      <div className="mx-auto -mt-8 max-w-xl px-4 pb-12">
        <p className="mb-3 text-center text-sm font-bold text-muted">عندك سؤال على طلبيتك؟</p>
        <ContactBlock socials={false} />
      </div>
    </>
  );
}
