'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { SUBJECT_LABELS, SUBJECT_COLOURS } from '@/components/chamber/constants';

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

type DebateRow = { id: string; stat_title: string; subject_area?: string; vote_for?: number; vote_against?: number; chat_count?: number; statement_count?: number; science_count?: number };

function DebateStatsMeta({ row }: { row: DebateRow }) {
  return (
    <div className="flex items-center gap-2 mt-1 flex-wrap">
      {row.subject_area && (
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold border ${SUBJECT_COLOURS[row.subject_area] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
          {SUBJECT_LABELS[row.subject_area] ?? row.subject_area}
        </span>
      )}
      {(row.statement_count ?? 0) > 0 && (
        <span className="flex items-center gap-1 text-xs text-slate-500" title="Statements">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
          </svg>
          {row.statement_count}
        </span>
      )}
      {((row.vote_for ?? 0) > 0 || (row.vote_against ?? 0) > 0) && (
        <span className="flex items-center gap-1 text-xs">
          <span className="text-emerald-500">{row.vote_for ?? 0}↑</span>
          <span className="text-rose-500">{row.vote_against ?? 0}↓</span>
        </span>
      )}
      {(row.science_count ?? 0) > 0 && (
        <span className="flex items-center gap-1 text-xs text-violet-400" title="Science Reports">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
          {row.science_count}
        </span>
      )}
      {(row.chat_count ?? 0) > 0 && (
        <span className="flex items-center gap-1 text-xs text-slate-500" title="Chat messages">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
          {row.chat_count}
        </span>
      )}
    </div>
  );
}

export default function HomePage() {
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const { user } = useAuth();

  const [favourites,    setFavourites]    = useState<DebateRow[] | null>(null);
  const [hotDebates,    setHotDebates]    = useState<DebateRow[] | null>(null);
  const [hotLoading,    setHotLoading]    = useState(true);

  // Fetch "What's Hot" for everyone
  useEffect(() => {
    fetch('/api/debates/hot')
      .then(r => r.ok ? r.json() : [])
      .then(setHotDebates)
      .catch(() => setHotDebates([]))
      .finally(() => setHotLoading(false));
  }, []);

  // Fetch favourites when logged in
  useEffect(() => {
    if (!user) { setFavourites(null); return; }
    fetch('/api/user/favourites')
      .then(r => r.ok ? r.json() : [])
      .then(setFavourites)
      .catch(() => setFavourites([]));
  }, [user]);

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
            {!user ? (
              <div className="rounded-lg border border-blue-900/15 bg-dr-base/60 px-6 py-6 text-center">
                <p className="text-sm text-slate-400 mb-3">Log in to see your favourite debates</p>
                <Link href="/login" className="rounded-lg border border-blue-700/40 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/10 transition-colors">
                  Log in
                </Link>
              </div>
            ) : favourites === null ? (
              <p className="text-sm text-slate-600 italic">Loading…</p>
            ) : favourites.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No favourites yet — star a debate in the Chamber to see it here.</p>
            ) : (
              <ul className="divide-y divide-slate-800/60">
                {favourites.map(d => (
                  <li key={d.id}>
                    <Link
                      href={`/chamber?resolution=${d.id}`}
                      className="block rounded-lg px-3 py-2.5 hover:bg-slate-800/60 transition-colors"
                    >
                      <p className="text-sm text-slate-200 font-medium leading-snug">{d.stat_title}</p>
                      <DebateStatsMeta row={d} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* What's Hot */}
          <div className="card-dr px-5 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-200">What&apos;s Hot</h2>
                <p className="text-xs text-slate-500 mt-0.5">Most recently active debates</p>
              </div>
              <Link href="/chamber" className="text-xs text-blue-500 hover:text-blue-400 transition-colors">
                Open Chamber →
              </Link>
            </div>
            {hotLoading ? (
              <p className="text-sm text-slate-600 italic">Loading…</p>
            ) : !hotDebates || hotDebates.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No debates yet.</p>
            ) : (
              <ul className="divide-y divide-slate-800/60">
                {hotDebates.map(d => (
                  <li key={d.id}>
                    <Link
                      href={`/chamber?resolution=${d.id}`}
                      className="block rounded-lg px-3 py-2.5 hover:bg-slate-800/60 transition-colors"
                    >
                      <p className="text-sm text-slate-200 font-medium leading-snug">{d.stat_title}</p>
                      <DebateStatsMeta row={d} />
                    </Link>
                  </li>
                ))}
              </ul>
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
