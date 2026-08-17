'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

type Society = {
  id: number;
  name: string;
  subdomain: string;
  description: string | null;
  is_public: boolean;
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

  useEffect(() => {
    fetch('/api/societies')
      .then(r => r.ok ? r.json() : [])
      .then(setSocieties)
      .catch(() => setSocieties([]));
  }, [user]); // re-fetch when login state changes

  const publicSocieties  = societies?.filter(s => s.is_public)  ?? [];
  const privateSocieties = societies?.filter(s => !s.is_public) ?? [];

  return (
    <div className="flex flex-col">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-dr-base pb-24 sm:pb-36">
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
          <h1 className="mb-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            <span style={{ color: '#93c5fd' }}>Question,</span>{' '}
            <span style={{ color: '#60a5fa' }}>debate,</span><br />
            <span style={{ color: '#2563eb' }}>justify,</span>{' '}
            <span style={{ color: '#00d0ff' }}>understand</span>
          </h1>

          {/* Subtext */}
          <p className="mx-auto mb-4 max-w-2xl text-lg sm:text-xl text-slate-400 leading-relaxed">
            Broaden your mind, deepen your understanding, and justify your position.
            Interactive debate on the issues that matter.
          </p>
          <p className="mx-auto mb-10 max-w-2xl text-base text-slate-500 leading-relaxed">
            Arguments are presented visually — pros and cons supported by evidence — so
            that you can reach a reasoned position. Courteous, challenging, and always
            evidence-led.
          </p>

          <p className="text-sm text-slate-500">
            Choose a society below to enter the debate, or{' '}
            <Link href="/about" className="text-blue-500 hover:text-blue-400 underline underline-offset-2 transition-colors">
              learn how it works
            </Link>
            .
          </p>
          <p className="mt-4 text-xs text-slate-600">
            Stay informed —{' '}
            <Link href="/blog" className="text-blue-500 hover:text-blue-400 underline underline-offset-2 transition-colors">
              read the blog &amp; subscribe
            </Link>
          </p>
        </div>
      </section>

      {/* ── Stats strip ───────────────────────────────────────── */}
      <div className="bg-dr-base px-4 sm:px-6 pb-10">
        <div className="mx-auto max-w-4xl grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { value: 'Public / Private Forums', label: 'debate format',                          color: 'text-blue-400',    bg: 'border-blue-800/30 bg-blue-500/5' },
            { value: 'Moderated',               label: 'all content reviewed',                   color: 'text-amber-400',   bg: 'border-amber-800/30 bg-amber-500/5' },
            { value: 'Evidence-led',            label: 'strengthen claims with evidence and data', color: 'text-emerald-400', bg: 'border-emerald-800/30 bg-emerald-500/5' },
            { value: 'AI-Assisted',             label: 'AI-assisted argumentation',              color: 'text-violet-400',  bg: 'border-violet-800/30 bg-violet-500/5' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border px-4 py-4 text-center ${s.bg}`}>
              <p className={`font-bold text-sm sm:text-base ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Society lists ─────────────────────────────────────── */}
      <div className="bg-dr-base px-4 sm:px-6 pb-4 space-y-4">
        <div className="mx-auto max-w-5xl space-y-4">

          {/* Public Societies */}
          {societies === null ? (
            <div className="card-dr px-5 py-6 text-center text-slate-600 text-sm italic">Loading societies…</div>
          ) : publicSocieties.length > 0 ? (
            <div className="card-dr overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800/60">
                <h2 className="text-base font-semibold text-slate-100">Open Societies</h2>
                <p className="text-xs text-slate-500 mt-0.5">Public debate platforms — open to everyone</p>
              </div>
              <div className="divide-y divide-slate-800/60">
                {publicSocieties.map(s => (
                  <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-200">{s.name}</p>
                      {s.description && <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        href="/chamber"
                        className="rounded-lg border border-blue-700/40 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors"
                      >
                        Debate Chamber
                      </Link>
                      <Link
                        href="/scotparl"
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
                      >
                        Society House →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Private Societies (logged-in members only) */}
          {user && privateSocieties.length > 0 && (
            <div className="card-dr overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800/60">
                <h2 className="text-base font-semibold text-slate-100">Your Private Societies</h2>
                <p className="text-xs text-slate-500 mt-0.5">Closed platforms — members only</p>
              </div>
              <div className="divide-y divide-slate-800/60">
                {privateSocieties.map(s => (
                  <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-200">{s.name}</p>
                      {s.description && <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>}
                      <span className="inline-flex items-center gap-1 mt-1 rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] text-slate-400 border border-slate-700/60">
                        🔒 Private
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link href="/chamber" className="rounded-lg border border-blue-700/40 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors">
                        Debate Chamber
                      </Link>
                      <Link href="/scotparl" className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors">
                        Society House →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

      {/* ── Blog strip ────────────────────────────────────────── */}
      <div className="bg-dr-base px-4 sm:px-6 pb-16">
        <div className="mx-auto max-w-5xl">
          <div className="card-dr px-5 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-200">From the Blog</h2>
                <p className="text-xs text-slate-500 mt-0.5">Thoughts on structured debate and building in public</p>
              </div>
              <Link href="/blog" className="text-xs text-blue-500 hover:text-blue-400 transition-colors">
                All posts →
              </Link>
            </div>
            <div className="rounded-lg border border-blue-900/15 bg-dr-base/60 px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200 mb-1">Welcome to debate.report</p>
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

    </div>
  );
}
