import type { Metadata } from "next";
import { Suspense } from "react";
import ThankYou from "./ThankYou";

export const metadata: Metadata = { title: "شكرا على طلبيتك", robots: { index: false } };

export default function Page() {
  return <Suspense><ThankYou /></Suspense>;
}
