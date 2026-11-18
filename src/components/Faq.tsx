export default function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="space-y-3">
      {items.map(({ q, a }) => (
        <details key={q} className="group rounded-2xl border border-line bg-white p-4 open:bg-soft">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-navy">
            {q}<span className="grid size-7 shrink-0 place-items-center rounded-full bg-soft text-lg transition group-open:rotate-45 group-open:bg-white">+</span>
          </summary>
          <p className="mt-2 leading-7 text-muted">{a}</p>
        </details>
      ))}
    </div>
  );
}
