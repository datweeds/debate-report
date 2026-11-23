import Link from 'next/link';

// Shared layout for plain policy and guide pages (procedures, young people's summary)
export function LegalPage({ crumbs, title, updated, intro, children }: {
  crumbs: { href?: string; label: string }[]; title: string; updated: string; intro?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-dr-base px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 mb-4">
            {crumbs.map((c, i) => (
              <span key={c.label} className="flex items-center gap-2">
                {i > 0 && <span>/</span>}
                {c.href ? <Link href={c.href} className="hover:text-slate-300 transition-colors">{c.label}</Link> : <span className="text-slate-300">{c.label}</span>}
              </span>
            ))}
          </div>
          <h1 className="text-4xl font-bold text-slate-100">{title}</h1>
          <p className="mt-2 text-slate-500 text-sm">Last updated: {updated}</p>
          {intro && <div className="mt-4 space-y-3 text-base leading-relaxed text-slate-300">{intro}</div>}
        </div>
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}

export function Card({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="card-dr scroll-mt-20 p-7">
      <h2 className="text-xl font-bold text-slate-100 mb-4">{title}</h2>
      <div className="space-y-3 text-sm text-slate-300 leading-relaxed">{children}</div>
    </div>
  );
}

export const A = 'text-blue-400 hover:underline';
export const B = 'font-semibold text-slate-200';
export function Bullets({ items }: { items: React.ReactNode[] }) {
  return <ul className="list-disc pl-5 space-y-1.5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
}
