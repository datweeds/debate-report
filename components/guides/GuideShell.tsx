import Link from 'next/link';
import FeatureNav from '@/components/FeatureNav';

// Shared layout for the Admin, Member and Guest guides: a header, a floating
// contents bar that follows the reader, then one band per section.

export type GuideSection = { id: string; title: string; short?: string; body: React.ReactNode };

export function P({ children }: { children: React.ReactNode }) {
  return <p className="leading-relaxed text-slate-300">{children}</p>;
}

export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 leading-relaxed text-slate-300">
          <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 flex-none rounded-full bg-blue-400" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** A labelled item: "Name — what it does". */
export function Item({ name, children }: { name: string; children: React.ReactNode }) {
  return <><strong className="font-semibold text-slate-100">{name}</strong> {children}</>;
}

export function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 leading-relaxed text-slate-300">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-300">{i + 1}</span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  );
}

export function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-slate-100">{title}</h3>
      {children}
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <div className="dr-panel rounded-xl px-4 py-3 text-sm leading-relaxed text-slate-300">{children}</div>;
}

export default function GuideShell({ kicker, title, lead, sections, others }: {
  kicker: string; title: string; lead: React.ReactNode; sections: GuideSection[];
  others: { href: string; label: string }[];
}) {
  return (
    <div className="min-h-screen bg-dr-base">
      <section className="mx-auto flex max-w-4xl flex-col gap-4 px-4 pb-8 pt-12 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-300">Home</Link><span>/</span>
          <Link href="/guides" className="hover:text-slate-300">Guides</Link><span>/</span>
          <span className="text-slate-300">{kicker}</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 sm:text-4xl">{title}</h1>
        <div className="max-w-2xl text-lg leading-relaxed text-slate-400">{lead}</div>
      </section>

      <FeatureNav sections={sections.map(s => ({ id: s.id, label: s.short ?? s.title }))} />

      {sections.map((s, i) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}
          className={`scroll-mt-32 ${i % 2 === 0 ? 'border-b border-blue-900/20 bg-dr-surface' : ''}`}>
          <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-10 sm:px-6">
            <h2 id={`${s.id}-h`} className="text-xl font-bold text-slate-100 sm:text-2xl">{s.title}</h2>
            {s.body}
          </div>
        </section>
      ))}

      <section className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-10 text-sm sm:px-6">
        <span className="text-slate-500">More guides:</span>
        {others.map(o => <Link key={o.href} href={o.href} className="rounded-full border border-blue-900/40 px-3.5 py-1.5 text-slate-300 hover:border-blue-500/60 hover:text-white">{o.label}</Link>)}
        <Link href="/features" className="rounded-full border border-blue-900/40 px-3.5 py-1.5 text-slate-300 hover:border-blue-500/60 hover:text-white">All features</Link>
      </section>
    </div>
  );
}

/** Shown in place of a members' guide to someone not logged in. */
export function LoginForGuide({ name }: { name: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold text-slate-100">The {name} is for members</h1>
      <p className="text-slate-400">Log in to read it. Visiting without an account? The Guest guide explains what you can see and do.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/guides/guest" className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Read the Guest guide</Link>
        <Link href="/login" className="rounded-lg border border-blue-700/50 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-blue-500/10">Log in</Link>
      </div>
    </div>
  );
}
