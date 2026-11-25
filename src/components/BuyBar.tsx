"use client";
import { useEffect, useState } from "react";

// شريط الشراء تحت: يختفي كي يكون الفورميلار قدام الزبون (باش ما يغطيش زر «أكّد الطلبية»)
// وكي يضغط عليه وهو بدا يعمّر: يدّيه نيشان للخانة الناقصة ولا لزر التأكيد (ماشي لفوق الفورميلار)
export default function BuyBar({ title, sub, price, compare }: { title: string; sub: string; price: string; compare?: string }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const form = document.getElementById("order");
    if (!form || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setHidden(e.isIntersecting), { threshold: 0.12 });
    io.observe(form);
    return () => io.disconnect();
  }, []);

  function go(e: React.MouseEvent) {
    const form = document.getElementById("order") as HTMLFormElement | null;
    if (!form) return;
    e.preventDefault();
    const field = (sel: string) => form.querySelector<HTMLInputElement | HTMLSelectElement>(sel);
    const name = field('input[name="name"]'), phone = field('input[name="phone"]');
    const started = Boolean(name?.value.trim() || phone?.value.trim());
    if (!started) { form.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    // أول خانة فارغة، ولا زر التأكيد إذا كلشي معمّر
    const order = [name, phone, field('select[aria-label="الولاية"]'), field('[aria-label="البلدية"]')];
    const empty = order.find((el) => el && !el.disabled && !el.value.trim());
    const target = empty || form.querySelector<HTMLButtonElement>('button[type="submit"]');
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (empty) setTimeout(() => empty.focus({ preventScroll: true }), 350);
    else target?.classList.add("ring-4", "ring-amber-300");
  }

  return (
    <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 p-3 backdrop-blur transition-transform duration-300 md:inset-x-auto md:bottom-5 md:left-1/2 md:w-[34rem] md:-translate-x-1/2 md:rounded-3xl md:border md:shadow-2xl ${hidden ? "pointer-events-none translate-y-[130%]" : ""}`} aria-hidden={hidden}>
      <a href="#order" onClick={go} tabIndex={hidden ? -1 : 0} className="cta-nudge cta-shine flex items-center justify-between rounded-2xl bg-brand px-5 py-3 font-extrabold text-white shadow-lg shadow-brand/30 md:py-3.5 md:text-lg">
        <span className="leading-tight">{title}<span className="block text-[11px] font-semibold opacity-80">{sub}</span></span>
        <span className="text-left">{price}{compare && <span className="block text-[11px] font-semibold line-through opacity-70">{compare}</span>}</span>
      </a>
    </div>
  );
}
