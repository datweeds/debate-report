'use client';

import PrivacyTile from '@/components/PrivacyTile';
import { ClosingCta, OnlyHere, SectionHead, ThreeSteps, ToolkitStrip, UseCases } from '@/components/home/HomeSections';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

type Society = {
  id: number;
  name: string;
  subdomain: string;
  description: string | null;
  is_public: boolean;
  visibility?: 'public' | 'apply' | 'invite';
  is_member: boolean;
};

const SUBJECT_AREAS = [
  { label: 'Culture, Identity & Social Issues', emoji: '🎭', slug: 'culture' },
  { label: 'Economics & Markets',               emoji: '📈', slug: 'economics' },
  { label: 'Education & Knowledge',             emoji: '📚', slug: 'education' },
  { label: 'Environment & Energy',              emoji: '🌍', slug: 'environment' },
  { label: 'Future & Existential Questions',    emoji: '🔮', slug: 'future' },
  { label: 'Health, Medicine & Bioethics',      emoji: '🏥', slug: 'health' },
  { label: 'History & Historical Interpretation', emoji: '📜', slug: 'history' },
  { label: 'Law, Rights & Justice',             emoji: '⚖️',  slug: 'law' },
  { label: 'Media, Information & Epistemology', emoji: '📡', slug: 'media' },
  { label: 'Philosophy, Ethics & Religion',     emoji: '🧠', slug: 'philosophy' },
  { label: 'Politics, Policy & Governance',     emoji: '🏛️', slug: 'politics' },
  { label: 'Science & Technology',              emoji: '🔬', slug: 'science' },
];


export default function HomePage() {
  const { user } = useAuth();
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [societies, setSocieties] = useState<Society[] | null>(null);
  const [entering, setEntering] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/societies')
      .then(r => r.ok ? r.json() : [])
      .then(setSocieties)
      .catch(() => setSocieties([]));
  }, [user]); // re-fetch when login state changes

  // "Society House" makes that society the active one (so proposals/bills/
  // principles pages and new-debate creation are scoped to it too), then
  // lands on its own dashboard — not the all-societies overview.
  async function enterSociety(id: number) {
    if (entering) return;
    setEntering(id);
    try {
      const r = await fetch('/api/customer/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: id }),
      });
      if (r.ok) window.location.href = `/scotparl?society=${id}`;
    } finally {
      setEntering(null);
    }
  }

  const publicSocieties  = societies?.filter(s => s.is_public)  ?? [];
  const privateSocieties = societies?.filter(s => !s.is_public) ?? [];

  return (
    <div className="flex flex-col">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-dr-base pb-12 sm:pb-16">
        {/* Subtle dark background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[#080c1a]"
        />
        {/* Subtle blue glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[700px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(ellipse, #3b82f6 0%, transparent 70%)' }}
        />

        {/* Full-width debate photo — replace the old strap line */}
        <div className="relative w-full overflow-hidden" style={{ height: '220px' }}>
          <img
            src="/images/chamber.jpg"
            alt="People engaged in discussion and debate"
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              objectPosition: '50% 35%',
              maskImage: 'radial-gradient(ellipse 82% 80% at 50% 50%, black 18%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 82% 80% at 50% 50%, black 18%, transparent 100%)',
            }}
          />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 text-center pt-10 sm:pt-14">

          {/* Headline */}
          <h1 className="dr-hero-title mb-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            <span style={{ color: '#93c5fd' }}>Where groups</span>{' '}
            <span style={{ color: '#60a5fa' }}>reason it through</span><br />
            <span style={{ color: '#00d0ff' }}>and decide together</span>
          </h1>

          {/* Subtext */}
          <p className="mx-auto mb-4 max-w-2xl text-lg sm:text-xl text-slate-400 leading-relaxed">
            Give your group one place for discussions, documents, events and video calls, with projects,
            polls and debates when you need them. Everything a community needs, free to start.
          </p>
          <p className="mx-auto mb-10 max-w-2xl text-base text-slate-500 leading-relaxed">
            Public when you want to be heard, private and encrypted when you don’t.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <a href="#societies" className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors">Find a Society</a>
            <Link href="/features" className="rounded-lg border border-blue-700/50 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-blue-500/10 transition-colors">See all features</Link>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-slate-400">
            {['Free to start', 'Encrypted private Societies', 'Polls and secret ballots', 'No ads or tracking', 'Your choice of AI'].map(t => (
              <span key={t} className="rounded-full border border-blue-900/40 px-3 py-1">{t}</span>
            ))}
          </div>
          <p className="mt-5 text-sm text-slate-500">
            New here?{' '}
            <a href="#how-it-works" className="text-blue-500 hover:text-blue-400 underline underline-offset-2 transition-colors">Learn how it works</a>.
          </p>
          <p className="mt-4 text-xs text-slate-600">
            Stay informed —{' '}
            <Link href="/blog" className="text-blue-500 hover:text-blue-400 underline underline-offset-2 transition-colors">
              read the newsletter &amp; subscribe
            </Link>
          </p>
        </div>
      </section>

      {/* ── Society lists ─────────────────────────────────────── */}
      <div id="societies" className="scroll-mt-24 bg-dr-base px-4 sm:px-6 pb-4 space-y-4">
        <div className="mx-auto max-w-5xl space-y-4">

          {societies === null && (
            <div className="card-dr px-5 py-6 text-center text-slate-600 text-sm italic">Loading societies…</div>
          )}

          {/* Public Societies */}
          {publicSocieties.length > 0 && (
            <section aria-labelledby="public-societies-h" className="space-y-4 pt-4">
              <SectionHead id="public-societies-h" eyebrow="Open to everyone" title="Public Societies" />
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {publicSocieties.map(s => (
                  <SocietyTile key={s.id} s={s} entering={entering === s.id} onEnter={() => enterSociety(s.id)} chamber />
                ))}
              </ul>
            </section>
          )}

          {/* Private Societies: Apply ones for everyone, Invite ones for their members */}
          {privateSocieties.length > 0 && (
            <section aria-labelledby="private-societies-h" className="space-y-4 pt-8">
              <SectionHead id="private-societies-h" eyebrow="For 2 or more people collaborating in private" title="Private Societies" />
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {privateSocieties.map(s => (
                  <SocietyTile key={s.id} s={s} entering={entering === s.id} onEnter={() => enterSociety(s.id)} chamber={s.is_member} />
                ))}
              </ul>
            </section>
          )}

        </div>
      </div>

      {/* ── Privacy: kept prominent, straight after the Societies ── */}
      <div className="bg-dr-base px-4 sm:px-6 pb-4">
        <div className="mx-auto max-w-5xl">
          <PrivacyTile />
        </div>
      </div>

      {/* ── Content sections ──────────────────────────────────── */}
      <div className="bg-dr-base px-4 sm:px-6 pb-16 space-y-4">
        <div className="mx-auto max-w-5xl space-y-4">

          {/* Debate Topics */}
          <div className="card-dr overflow-hidden">
            <button
              onClick={() => setSubjectsOpen(o => !o)}
              className="group flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-blue-500/5"
            >
              <div>
                <h2 className="text-base font-semibold text-slate-200 group-hover:text-blue-300 transition-colors">
                  Debate Topics
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Browse debates by subject area</p>
              </div>
              <svg
                className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${subjectsOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
              </svg>
            </button>

            {subjectsOpen && (
              <div className="border-t border-blue-900/15 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {SUBJECT_AREAS.map((s, i) => (
                  <Link
                    key={s.slug}
                    href={`/chamber?subject=${s.slug}`}
                    className={`flex items-center gap-3 px-5 py-3 text-sm text-slate-300 transition-colors hover:bg-blue-500/5 hover:text-blue-300 ${i % 3 !== 2 ? 'sm:border-r border-blue-900/10' : ''} border-b border-blue-900/10`}
                  >
                    <span className="text-xl leading-none">{s.emoji}</span>
                    {s.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── What new.vote is for ───────────────────────────────── */}
      <OnlyHere />
      <UseCases />
      <ThreeSteps />
      <ToolkitStrip />

      {/* ── Blog strip ────────────────────────────────────────── */}
      <div className="bg-dr-base px-4 sm:px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="card-dr px-5 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-200">From the Newsletter</h2>
                <p className="text-xs text-slate-500 mt-0.5">Thoughts on structured debate and building in public</p>
              </div>
              <Link href="/blog" className="text-xs text-blue-500 hover:text-blue-400 transition-colors">
                All posts →
              </Link>
            </div>
            <div className="rounded-lg border border-blue-900/15 bg-dr-base/60 px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200 mb-1">Welcome to new.vote</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Structured, evidence-led debate for everyone. Here&apos;s what we&apos;re building, why it matters, and what comes next.
                </p>
              </div>
              <Link
                href="/blog/welcome-to-debate-report"
                className="flex-shrink-0 rounded-lg border border-blue-700/40 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors"
              >
                Read
              </Link>
            </div>
            <p className="text-xs text-slate-600 mt-4 text-center">
              <Link href="/blog" className="text-blue-500 hover:text-blue-400 underline underline-offset-2 transition-colors">
                Subscribe to get new articles by email
              </Link>
            </p>
          </div>
        </div>
      </div>

      <ClosingCta />
    </div>
  );
}

// One Society as a tile: its name (to its About page), what it's for, and the way in
function SocietyTile({ s, entering, onEnter, chamber }: { s: Society; entering: boolean; onEnter: () => void; chamber?: boolean }) {
  return (
    <li className="card-dr flex flex-col gap-2 p-4">
      <Link href={`/society/${s.subdomain || s.id}/about`} className="text-sm font-semibold text-slate-100 hover:text-blue-300 hover:underline underline-offset-4 decoration-blue-400/50">
        {s.name}
      </Link>
      {!s.is_public && (
        <span className="self-start rounded border border-slate-700/60 bg-slate-700/50 px-1.5 py-0.5 text-[10px] text-slate-400">
          🔒 {s.is_member ? 'Member' : s.visibility === 'apply' ? 'Apply to join' : 'Invite only'}
        </span>
      )}
      {s.description && <p className="line-clamp-3 text-xs leading-relaxed text-slate-500">{s.description}</p>}
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <button onClick={onEnter} disabled={entering}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors">
          {entering ? 'Entering…' : `${s.name} house →`}
        </button>
        {chamber && (
          <Link href="/chamber" className="rounded-lg border border-blue-700/40 px-3 py-1.5 text-center text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors">
            Debate Chamber
          </Link>
        )}
      </div>
    </li>
  );
}
