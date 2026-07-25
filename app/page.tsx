'use client';

import { useState } from 'react';
import Link from 'next/link';

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
  const [subjectsOpen, setSubjectsOpen] = useState(false);

  const isLoggedIn = false;

  return (
    <div className="flex flex-col">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-dr-base py-24 sm:py-36">
        {/* Photo: people sitting in a circle on grass by Beth Macdonald / Unsplash (free to use) */}
        <img
          src="/images/chamber.jpg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-30"
        />
        {/* Gradient overlays — dark vignette + blue tint */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: [
              'linear-gradient(to bottom, rgba(8,12,25,0.55) 0%, rgba(8,12,25,0.35) 40%, rgba(8,12,25,0.65) 80%, rgba(8,12,25,0.95) 100%)',
              'linear-gradient(to right,  rgba(8,12,25,0.6) 0%, transparent 40%, transparent 60%, rgba(8,12,25,0.6) 100%)',
            ].join(', '),
          }}
        />
        {/* Subtle blue glow over image */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[700px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(ellipse, #3b82f6 0%, transparent 70%)' }}
        />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 text-center">

          {/* Eyebrow */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-700/30 bg-blue-500/10 px-4 py-1.5 text-xs font-medium text-blue-300 tracking-wide uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            Strictly moderated · Evidence-based · Open to all
          </div>

          {/* Headline */}
          <h1 className="mb-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-50 leading-tight">
            Where reason<br />
            <span className="text-gradient-blue">meets debate</span>
          </h1>

          {/* Subtext */}
          <p className="mx-auto mb-4 max-w-2xl text-lg sm:text-xl text-slate-400 leading-relaxed">
            An online platform dedicated to structured, interactive debate on the issues
            that matter — for the United Kingdom and beyond.
          </p>
          <p className="mx-auto mb-10 max-w-2xl text-base text-slate-500 leading-relaxed">
            Arguments are presented visually — pros and cons supported by evidence — so
            that you can reach a reasoned position. Courteous, challenging, and always
            evidence-led.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/chamber"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-blue-500 hover:shadow-blue-500/25 hover:shadow-xl active:scale-[0.98]"
            >
              Enter the Chamber
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/about"
              className="dr-btn-ghost inline-flex items-center gap-2 rounded-xl border border-slate-600 px-6 py-3 text-sm font-medium text-slate-300 transition-colors"
            >
              How it works
            </Link>
          </div>

          <p className="mt-8 text-xs text-slate-600">
            Stay informed —{' '}
            <button className="text-blue-500 hover:text-blue-400 underline underline-offset-2 transition-colors">
              subscribe to our newsletter
            </button>
          </p>
        </div>
      </section>

      {/* ── Stats strip ───────────────────────────────────────── */}
      <div className="bg-dr-base px-4 sm:px-6 pb-10">
        <div className="mx-auto max-w-4xl grid grid-cols-3 gap-3">
          {[
            { value: 'Public Forum',  label: 'debate format',            color: 'text-blue-400',    bg: 'border-blue-800/30 bg-blue-500/5' },
            { value: 'Moderated',     label: 'all content reviewed',     color: 'text-amber-400',   bg: 'border-amber-800/30 bg-amber-500/5' },
            { value: 'Evidence-led',  label: 'claims must be supported', color: 'text-emerald-400', bg: 'border-emerald-800/30 bg-emerald-500/5' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border px-4 py-4 text-center ${s.bg}`}>
              <p className={`font-bold text-sm sm:text-base ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
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

          {/* Your Favourites */}
          <div className="card-dr px-5 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-200">Your Favourite Debates</h2>
                <p className="text-xs text-slate-500 mt-0.5">Debates you have bookmarked</p>
              </div>
            </div>
            {isLoggedIn ? (
              <p className="text-sm text-slate-500 italic">No favourites yet — star a debate in the Chamber to see it here.</p>
            ) : (
              <div className="rounded-lg border border-blue-900/15 bg-dr-base/60 px-6 py-6 text-center">
                <p className="text-sm text-slate-400 mb-3">Log in to see your favourite debates</p>
                <Link href="/login" className="rounded-lg border border-blue-700/40 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/10 transition-colors">
                  Log in
                </Link>
              </div>
            )}
          </div>

          {/* What's Hot */}
          <div className="card-dr px-5 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-200">What&apos;s Hot</h2>
                <p className="text-xs text-slate-500 mt-0.5">The 20 most recently active debate statements</p>
              </div>
              <Link href="/chamber" className="text-xs text-blue-500 hover:text-blue-400 transition-colors">
                View all →
              </Link>
            </div>
            {isLoggedIn ? (
              <p className="text-sm text-slate-500 italic">Loading recent activity…</p>
            ) : (
              <div className="rounded-lg border border-blue-900/15 bg-dr-base/60 px-6 py-6 text-center">
                <p className="text-sm text-slate-400 mb-3">Log in to see recent activity across all debates</p>
                <Link href="/login" className="rounded-lg border border-blue-700/40 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/10 transition-colors">
                  Log in
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
