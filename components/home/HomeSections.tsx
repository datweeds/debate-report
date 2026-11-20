import Link from 'next/link';
import { FEATURES } from '@/lib/features';

// Home page sections: who new.vote is for, how a Society starts, what only
// new.vote does, the toolkit, and a closing call to action.

export function Eyebrow({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return accent
    ? <span className="self-start rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-slate-950">{children}</span>
    : <span className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-400">{children}</span>;
}

export function SectionHead({ eyebrow, title, lead, accent, id, right }: {
  eyebrow?: string; title: string; lead?: string; accent?: boolean; id: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-3xl flex-col gap-2">
        {eyebrow && <Eyebrow accent={accent}>{eyebrow}</Eyebrow>}
        <h2 id={id} className="text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">{title}</h2>
        {lead && <p className="text-base leading-relaxed text-slate-400">{lead}</p>}
      </div>
      {right}
    </div>
  );
}

const band = 'border-y border-blue-900/20 bg-dr-surface';
const wrap = 'mx-auto flex max-w-5xl flex-col gap-8 px-4 py-16 sm:px-6';

const USES = [
  { title: 'Civic and campaign groups', text: 'Debate policy in the open, weigh the evidence, and vote on what to do next.' },
  { title: 'Project Teams', text: 'Two or more people collaborating on a project. Gantt chart, RAID, etc included.' },
  { title: 'Clubs, co-ops and unions', text: 'Agree rules, run secret ballots and keep members informed in one private space.' },
  { title: 'Schools and debating societies', text: 'Teach argument structure: claims, evidence and rebuttals, mapped where everyone can see them.' },
  { title: 'Research and expert networks', text: 'Test claims against sources, share papers, and record where the evidence leads.' },
  { title: 'Local communities', text: 'News, events, discussions and decisions for a neighbourhood, run by its own members.' },
];

export function UseCases() {
  return (
    <section aria-labelledby="uses-h" className={band}>
      <div className={wrap}>
        <SectionHead id="uses-h" eyebrow="Who it’s for" title="Built for groups that decide things together" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USES.map(u => (
            <div key={u.title} className="flex flex-col gap-2 rounded-xl border border-blue-900/25 bg-dr-card p-5">
              <h3 className="text-base font-semibold text-slate-100">{u.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{u.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: '01', title: 'Start a Society', text: 'Name it, add your moderators and write the principles it runs by.' },
  { n: '02', title: 'Make it fit', text: 'Switch on the tools you need, from debates and polls to calls and projects, and leave the rest off.' },
  { n: '03', title: 'Choose who sees it', text: 'Public to everyone, open to apply, or invitation only. Private Societies are encrypted.' },
];

export function ThreeSteps() {
  return (
    <section id="how-it-works" aria-labelledby="how-h" className={`${wrap} scroll-mt-20`}>
      <SectionHead id="how-h" eyebrow="How it works" title="Three steps to your own Society" />
      <ol className="grid gap-6 sm:grid-cols-3">
        {STEPS.map(s => (
          <li key={s.n} className="flex flex-col gap-2 border-t-2 border-blue-500 pt-4">
            <span className="text-2xl font-bold text-blue-400">{s.n}</span>
            <span className="text-lg font-semibold text-slate-100">{s.title}</span>
            <span className="text-sm leading-relaxed text-slate-400">{s.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export const ONLY_HERE = [
  { title: 'Debate you can see', text: 'Arguments laid out as a map: each claim with its evidence, rebuttals and the votes behind it, so you can follow how a conclusion was reached.' },
  { title: 'Ballots you can trust', text: 'Secret ballots that can’t be linked to voters, a receipt to check your vote was counted, a published list of receipts, and a full recount for moderators.' },
  { title: 'Private means private', text: 'Private Societies are encrypted with their own key. Our admins can only look inside in an emergency, and every look is logged and shown to the Society.' },
  { title: 'Your choice of AI', text: 'Quality checks, summaries and news, with new.vote’s AI, your own provider, or none at all, and a spending limit you set.' },
];

export function OnlyHere() {
  return (
    <section aria-labelledby="only-h" className={wrap}>
      <SectionHead id="only-h" eyebrow="Only in new.vote" accent title="What you won’t find elsewhere"
        lead="Most community platforms are built for chatting. new.vote is built for reasoning things through and deciding." />
      <div className="grid gap-4 sm:grid-cols-2">
        {ONLY_HERE.map(f => (
          <div key={f.title} className="flex flex-col gap-2 rounded-xl border-2 border-amber-400/70 bg-dr-card p-6">
            <h3 className="text-lg font-semibold text-slate-100">{f.title}</h3>
            <p className="text-sm leading-relaxed text-slate-400">{f.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const ICONS: Record<string, string> = {
  debates: 'M8 9h8M8 13h5m-9 7 4-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3l-4 4Z',
  polls: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  news: 'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z',
  discussions: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155',
  meet: 'm15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z',
  documents: 'M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z',
  events: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
  projects: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z',
  principles: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
};

export function FeatureIcon({ k, className = 'h-5 w-5' }: { k: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[k]} />
    </svg>
  );
}

export function ToolkitStrip() {
  return (
    <section aria-labelledby="kit-h" className={band}>
      <div className={wrap}>
        <SectionHead id="kit-h" eyebrow="The Society toolkit" title="Everything your Society needs, nothing it doesn’t"
          lead="Every Society starts with all of these. Its admins switch off what they don’t use, and can switch it back on at any time."
          right={<Link href="/features" className="text-sm font-semibold text-blue-400 hover:text-blue-300">See all features →</Link>} />
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-3">
          {FEATURES.map(f => (
            <Link key={f.key} href={`/features#${f.key}`}
              className="flex w-60 flex-none flex-col gap-1.5 rounded-xl border border-blue-900/25 bg-dr-card p-4 transition-colors hover:border-blue-500/50 sm:w-auto">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-100"><span className="text-blue-400"><FeatureIcon k={f.key} /></span>{f.label}</span>
              <span className="text-xs leading-relaxed text-slate-400">{f.blurb}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClosingCta() {
  return (
    <section aria-labelledby="cta-h" className="dr-dark bg-blue-700">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6">
        <h2 id="cta-h" className="text-2xl font-bold text-white sm:text-3xl">Ready to reason it through?</h2>
        <p className="text-blue-100">Join a Society and take part, or start one for your own group.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <a href="/#societies" className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-50">Find a Society</a>
          <Link href="/features" className="rounded-lg border border-white px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">See all features</Link>
          <Link href="/pricing" className="rounded-lg border border-white px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">Start a Society</Link>
        </div>
      </div>
    </section>
  );
}
