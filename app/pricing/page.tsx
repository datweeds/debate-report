import type { Metadata } from 'next';
import Link from 'next/link';
import PricingActions from '@/components/pricing/PricingActions';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'new.vote is free to vote and debate. Moderators run their own Societies for £9 a month.',
};

// Simple pricing: everyone votes and debates free; Moderators pay to run
// Societies. (The earlier tiered page is kept in components/pricing/LegacyPricing.tsx.)
const FREE = [
  'Join public Societies, and apply to join private ones',
  'Read every public debate',
  'Vote on statements and debates',
  'Write claims, evidence and rebuttals as a Debater',
  'Chat, discuss, and use Society documents and calendars',
  'Register with just a username: no email or password needed',
];

const MODERATOR = [
  'Create unlimited Societies, public or private (by application or by invitation)',
  'Public and private debates and votes, with Apply and Invite access',
  'Discussions, documents (up to 50 MB each), events calendar and projects',
  'Society principles your members can discuss and debate',
  'Debate Quality Reports and live quality checks',
  'Invite links, join requests and co-moderators',
  'Move or copy debates and documents between your Societies',
];

function Tick() {
  return (
    <svg className="h-4 w-4 flex-shrink-0 text-emerald-400 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <div className="px-4 sm:px-6 py-14">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-100">Free to take part. Moderators run Societies.</h1>
          <p className="mt-3 text-slate-400">Voting and debating cost nothing. Moderators pay to create and run their own Societies.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="card-dr p-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-300">Voters &amp; Debaters</p>
            <p className="mt-2 text-4xl font-bold text-slate-100">Free</p>
            <ul className="mt-6 space-y-2.5">
              {FREE.map(f => <li key={f} className="flex gap-2 text-sm text-slate-300"><Tick />{f}</li>)}
            </ul>
            <PricingActions kind="free" />
          </div>

          <div className="card-dr p-6 border-emerald-500/40">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">Moderator</p>
            <p className="mt-2 text-4xl font-bold text-slate-100">£9<span className="text-base font-medium text-slate-400"> / month</span></p>
            <p className="mt-1 text-xs text-amber-300">Free while billing is in preview. Request access and we&apos;ll switch it on.</p>
            <ul className="mt-6 space-y-2.5">
              {MODERATOR.map(f => <li key={f} className="flex gap-2 text-sm text-slate-300"><Tick />{f}</li>)}
            </ul>
            <PricingActions kind="moderator" />
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          Questions? <Link href="/contact" className="text-blue-400 hover:underline">Contact us</Link>.
          {' '}Read how we handle your data in our <Link href="/privacy" className="text-blue-400 hover:underline">privacy policy</Link>.
        </p>
      </div>
    </div>
  );
}
