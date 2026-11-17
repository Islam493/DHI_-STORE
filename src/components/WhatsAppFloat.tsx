import { whatsappLink } from "@/lib/config";

export default function WhatsAppFloat() {
  const wa = whatsappLink("السلام عليكم، عندي سؤال على منتج");
  if (!wa) return null;
  return (
    <a href={wa} target="_blank" rel="noopener" aria-label="راسلنا على واتساب"
      className="fixed bottom-20 left-4 z-40 grid size-14 place-items-center rounded-full bg-wa text-white shadow-lg md:bottom-6">
      <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-1 1.2-.4.2-.7 0a8 8 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.8.4 3.5 3.5 0 0 0-1.1 2.6 6 6 0 0 0 1.3 3.2 13.8 13.8 0 0 0 5.3 4.7c2 .8 2.7.9 3.7.7a3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3zM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zm8.4-18.2A11.8 11.8 0 0 0 1.8 17.8L.1 24l6.4-1.7A11.8 11.8 0 0 0 23.8 12a11.7 11.7 0 0 0-3.4-8.4z"/></svg>
    </a>
  );
}
