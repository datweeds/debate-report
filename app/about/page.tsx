import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about debate.report — our mission, approach and the principles behind structured online debate.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-dr-base px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl">

        <div className="mb-10">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
            <Link href="/" className="hover:text-slate-300 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-slate-300">About Us</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-100">About debate.report</h1>
        </div>

        <div className="prose-dr space-y-8">

          <div className="card-dr p-7">
            <h2 className="text-xl font-bold text-slate-100 mb-3">Our Mission</h2>
            <p className="text-slate-300 leading-relaxed">
              debate.report is a structured online debate platform designed to raise the quality of public discourse.
              We believe that good arguments should be visible, traceable and judged on their merits — not on how loudly
              they are shouted. Our platform presents debates as structured argument graphs: claims supported by warrants,
              warrants backed by evidence, and rebuttals that challenge each step of the chain.
            </p>
          </div>

          <div className="card-dr p-7">
            <h2 className="text-xl font-bold text-slate-100 mb-3">Why Structured Debate?</h2>
            <p className="text-slate-300 leading-relaxed mb-4">
              Most online debate is chaotic. Arguments get buried, context is lost and participants talk past each other.
              Structured debate changes this by requiring each contribution to declare what it is — a claim, a warrant,
              a piece of evidence, or a rebuttal — and what it is arguing for or against.
            </p>
            <p className="text-slate-300 leading-relaxed">
              The result is a visual graph that any reader can follow from top to bottom, understanding exactly how each
              argument supports or challenges the central resolution. Moderators review contributions to ensure they
              meet the required standard before publication.
            </p>
          </div>

          <div className="card-dr p-7">
            <h2 className="text-xl font-bold text-slate-100 mb-3">Statement Types</h2>
            <div className="space-y-4">
              {[
                { type: 'Resolution', colour: 'text-amber-300', desc: 'The central proposition being debated. Resolutions are written by moderators and form the root of the argument graph.' },
                { type: 'Claim',      colour: 'text-slate-300', desc: 'A top-level argument for or against the resolution. Claims must be clear, falsifiable statements.' },
                { type: 'Warrant',    colour: 'text-violet-300', desc: 'A logical reason that explains why a claim is true or how it relates to the resolution.' },
                { type: 'Evidence',   colour: 'text-emerald-300', desc: 'A cited fact, study, statistic or source that supports a claim or warrant.' },
                { type: 'Rebuttal',   colour: 'text-rose-300', desc: 'A counter-argument that directly challenges an existing claim, warrant or piece of evidence.' },
              ].map(s => (
                <div key={s.type} className="flex gap-3">
                  <span className={`text-sm font-bold w-24 flex-shrink-0 ${s.colour}`}>{s.type}</span>
                  <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card-dr p-7">
            <h2 className="text-xl font-bold text-slate-100 mb-3">Our Principles</h2>
            <ul className="space-y-3">
              {[
                'Arguments are judged on logic and evidence, not on who made them.',
                'Every contribution is reviewed by a moderator before publication.',
                'Both sides of every debate are represented and weighted fairly.',
                'Sources must be cited; unsupported assertions are not permitted.',
                'Personal attacks, misinformation and bad-faith participation are removed.',
              ].map((p, i) => (
                <li key={i} className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span className="text-slate-300 text-sm">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-dr p-7">
            <h2 className="text-xl font-bold text-slate-100 mb-3">Get in Touch</h2>
            <p className="text-slate-300 leading-relaxed mb-4">
              We welcome feedback, partnership enquiries and questions about the platform.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              Contact Us →
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
