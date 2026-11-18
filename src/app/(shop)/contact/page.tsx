import type { Metadata } from "next";
import ContactBlock from "@/components/ContactBlock";

export const metadata: Metadata = { title: "اتصل بنا", description: "تواصل مع DHI Electronics بالهاتف، الواتساب ولا مواقع التواصل.", alternates: { canonical: "/contact" } };

export default function Contact() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-navy">اتصل بنا</h1>
        <p className="mt-3 text-muted">عندك سؤال على منتج ولا على طلبيتك؟ عيطلنا ولا راسلنا، فريق DHI Electronics يجاوبك.</p>
      </div>
      <div className="mt-8 rounded-3xl bg-soft p-5 md:p-6"><ContactBlock /></div>
    </div>
  );
}
