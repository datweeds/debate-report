import Link from 'next/link';
import type { Metadata } from 'next';
import { FEATURES } from '@/lib/features';

export const metadata: Metadata = {
  title: 'About',
  description: 'About new.vote and Debate Report Limited, the company that makes it: what we build, what we believe, and how new.vote grew out of debate.report.',
};

const BELIEFS = [
  { title: 'Sophisticated community tools', text: 'Debates mapped argument by argument; secret ballots with receipts and full recounts, and ranked-choice runoffs; encrypted private Societies and end-to-end encrypted calls; and a news magazine built around your topics.' },
  { title: 'Groups run themselves', text: 'Each Society sets its own rules, Society Admins and tools. We provide the space; its members decide how it works.' },
  { title: 'Private means private', text: 'Private Societies are encrypted with their own key, and our team has no routine access to what’s inside.' },
  { title: 'No ads, no tracking', text: 'We don’t sell attention or data. new.vote uses only the cookies the site needs to work.' },
  { title: 'Fair to every side', text: 'Both sides of a debate are set out and weighed on the same terms, and votes are counted openly and accurately.' },
  { title: 'Your choice of AI', text: 'AI should help, not decide. Each Society chooses new.vote’s AI, its own provider, or none at all.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-dr-base">
      <section className="mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6">
        <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="transition-colors hover:text-slate-300">Home</Link><span>/</span><span className="text-slate-300">About</span>
        </div>
        <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-slate-100 sm:text-5xl">A place for groups to reason it through and decide together</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">
          new.vote gives every Society its own space to debate with evidence, vote by secret ballot, talk, meet and plan,
          run by its own members, public when it wants to be heard and private when it doesn’t.
        </p>
      </section>

      <section aria-labelledby="who-h" className="border-y border-blue-900/20 bg-dr-surface">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1fr_20rem]">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-400">Who we are</span>
            <h2 id="who-h" className="text-2xl font-bold text-slate-100">Made by Debate Report Limited</h2>
            <p className="leading-relaxed text-slate-300">
              new.vote is made and run by Debate Report Limited. We started with debate.report, a platform for
              structured online debate that set out arguments as a visual map of claims, evidence and rebuttals, so anyone
              could follow how a conclusion was reached.
            </p>
            <p className="leading-relaxed text-slate-300">
              new.vote carries that debate engine forward and builds a whole toolkit around it, because the groups that
              debate also need to decide, organise and keep their conversations their own.
            </p>
          </div>
          <dl className="self-start rounded-xl border border-blue-900/25 bg-dr-card p-5 text-sm">
            <dt className="text-xs uppercase tracking-wider text-slate-500">Company</dt>
            <dd className="mt-0.5 text-slate-200">Debate Report Limited</dd>
            <dt className="mt-3 text-xs uppercase tracking-wider text-slate-500">Company number</dt>
            <dd className="mt-0.5 text-slate-200">SC858643</dd>
            <dt className="mt-3 text-xs uppercase tracking-wider text-slate-500">Registered in</dt>
            <dd className="mt-0.5 text-slate-200">Scotland, as a private limited company</dd>
            <dt className="mt-3 text-xs uppercase tracking-wider text-slate-500">Product</dt>
            <dd className="mt-0.5 text-slate-200">new.vote <span className="text-slate-500">(formerly debate.report)</span></dd>
          </dl>
        </div>
      </section>

      <section aria-labelledby="journey-h" className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-400">From debate.report to new.vote</span>
          <h2 id="journey-h" className="text-2xl font-bold text-slate-100">From one tool to a whole Society</h2>
        </div>
        <ol className="max-w-3xl">
          <li className="flex flex-col gap-2 border-t-2 border-blue-500 pt-4">
            <span className="text-sm font-semibold text-blue-300">new.vote</span>
            <p className="text-sm leading-relaxed text-slate-300">
              Societies with their own members and Society Admins, and a toolkit they switch on as they need it:{' '}
              {FEATURES.map(f => f.label).join(', ').replace(/, ([^,]*)$/, ' and $1')}. Private Societies are encrypted, and
              ballots are secret and verifiable.
            </p>
            <Link href="/features" className="text-sm font-semibold text-blue-400 hover:text-blue-300">See all features →</Link>
          </li>
        </ol>
      </section>

      <section aria-labelledby="believe-h" className="border-y border-blue-900/20 bg-dr-surface">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-14 sm:px-6">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-400">What we believe</span>
            <h2 id="believe-h" className="text-2xl font-bold text-slate-100">How we build new.vote</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BELIEFS.map(b => (
              <div key={b.title} className="flex flex-col gap-2 rounded-xl border border-blue-900/25 bg-dr-card p-5">
                <h3 className="text-base font-semibold text-slate-100">{b.title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="contact-h" className="mx-auto grid max-w-5xl gap-4 px-4 py-14 sm:grid-cols-3 sm:px-6">
        <h2 id="contact-h" className="sr-only">Get in touch</h2>
        {[
          { title: 'Talk to us', text: 'Questions, feedback or partnership ideas.', href: '/contact', cta: 'Contact us' },
          { title: 'Support and investment', text: 'Help us build new.vote, or invest in its future.', href: '/support', cta: 'Support & Investors' },
          { title: 'How debate works', text: 'Statement types, the principles of fair debate and the Debate Chamber.', href: '/how-it-works', cta: 'Learn how it works' },
        ].map(c => (
          <div key={c.title} className="flex flex-col gap-2 rounded-xl border border-blue-900/25 bg-dr-surface p-5">
            <h3 className="text-base font-semibold text-slate-100">{c.title}</h3>
            <p className="flex-1 text-sm leading-relaxed text-slate-400">{c.text}</p>
            <Link href={c.href} className="text-sm font-semibold text-blue-400 hover:text-blue-300">{c.cta} →</Link>
          </div>
        ))}
      </section>
    </div>
  );
}
