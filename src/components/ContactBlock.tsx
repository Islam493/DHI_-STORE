import { contacts, getSettings } from "@/lib/settings";
import { IconPhone, IconWhatsapp, socialMeta } from "./SocialIcons";

// بلوك التواصل الموحد: الهاتف، الواتساب، والسوشيال (يتقرا من الإعدادات)
export default async function ContactBlock({ dark = false, socials = true, compact = false }: { dark?: boolean; socials?: boolean; compact?: boolean }) {
  const c = contacts(await getSettings());
  const btn = dark ? "bg-white/10 text-white hover:bg-white/20" : "bg-white text-navy ring-1 ring-line hover:ring-brand";
  return (
    <div className="space-y-3">
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "sm:grid-cols-2"}`}>
        {c.phones.map((p, i) => (
          <a key={p.n} href={p.href} className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${btn}`}>
            <IconPhone className="size-4 shrink-0 text-brand" />
            <span className="min-w-0"><span className="block text-[11px] font-semibold opacity-70">{i === 0 ? "الهاتف الأول" : "الهاتف الثاني"}</span><span dir="ltr">{p.n}</span></span>
          </a>
        ))}
        {c.whatsapps.map((w, i) => (
          <a key={w.n} href={w.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-2xl bg-wa px-4 py-3 text-sm font-bold text-white transition hover:brightness-95">
            <IconWhatsapp className="size-4 shrink-0" />
            <span className="min-w-0"><span className="block text-[11px] font-semibold opacity-80">واتساب {i === 0 ? "1" : "2"}</span><span dir="ltr">{w.n}</span></span>
          </a>
        ))}
      </div>
      {socials && (
        <div className="flex flex-wrap gap-2">
          {socialMeta.map(({ k, name, Icon, color }) => c.socials[k] && (
            <a key={k} href={c.socials[k]} target="_blank" rel="noopener noreferrer" aria-label={name} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 ${color}`}>
              <Icon className="size-4" />{name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
