'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Metrics = Record<string, number>;

const PERIODS = [1, 7, 30, 90, 365];

// Activity in the Society: a tile per section with its total and what's new
// in the last N days, each linking to the section.
export default function SocietyMetrics({ societyId }: { societyId: number }) {
  const [days, setDays] = useState(7);
  const [custom, setCustom] = useState('');
  const [m, setM] = useState<Metrics | null>(null);

  // Remember the reader's chosen period
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem('dr_metrics_days'));
      if (saved >= 1 && saved <= 3650) setDays(saved);
    } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem('dr_metrics_days', String(days)); } catch { /* storage unavailable */ }
    let cancelled = false;
    fetch(`/api/societies/${societyId}/metrics?days=${days}`).then(r => r.ok ? r.json() : null).then(d => {
      if (!cancelled && d) setM(d.metrics);
    });
    return () => { cancelled = true; };
  }, [societyId, days]);

  const base = `/society/${societyId}`;
  const tiles: { label: string; href: string; total: number; recent: number; detail?: string }[] = m ? [
    { label: 'Debates', href: base, total: m.debates, recent: m.debates_recent,
      detail: `${m.arguments} arguments · ${m.arguments_recent} new` },
    { label: 'News editions', href: `${base}/news`, total: m.news, recent: m.news_recent },
    { label: 'Discussions', href: `${base}/discussions`, total: m.threads, recent: m.threads_recent,
      detail: `${m.posts} messages · ${m.posts_recent} new` },
    { label: 'Calls joined', href: `${base}/meet`, total: m.call_joins, recent: m.call_joins_recent },
    { label: 'Documents', href: `${base}/documents`, total: m.documents, recent: m.documents_recent },
    { label: 'Events', href: `${base}/events`, total: m.events, recent: m.events_recent,
      detail: `${m.events_upcoming} upcoming` },
    { label: 'Projects', href: `${base}/projects`, total: m.projects, recent: m.projects_recent,
      detail: `${m.tasks} tasks · ${m.tasks_recent} new` },
    { label: 'Principles', href: `${base}/principles`, total: m.principles, recent: m.principle_versions_recent,
      detail: m.principle_versions_recent ? undefined : 'no new versions' },
    { label: 'Members', href: `${base}/about`, total: m.members, recent: m.members_recent },
  ] : [];

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0c1322] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-200">Activity</h2>
        <div className="flex flex-wrap items-center gap-1 text-xs" role="group" aria-label="Period">
          <span className="mr-1 text-slate-500">New in the last</span>
          {PERIODS.map(p => (
            <button key={p} onClick={() => { setDays(p); setCustom(''); }}
              className={`rounded-md px-2 py-1 ${days === p && !custom ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
              {p === 1 ? 'day' : p === 365 ? 'year' : `${p} days`}
            </button>
          ))}
          <input inputMode="numeric" value={custom} placeholder="days" aria-label="Number of days"
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4);
              setCustom(v);
              const n = Number(v);
              if (n >= 1 && n <= 3650) setDays(n);
            }}
            className={`w-14 rounded-md border bg-slate-900 px-2 py-1 text-slate-200 ${custom ? 'border-blue-500/60' : 'border-slate-700'}`} />
        </div>
      </div>
      {!m ? (
        <div className="h-28 rounded-xl bg-slate-800/40 animate-pulse" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map(t => (
            <Link key={t.label} href={t.href}
              className="group rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 transition-colors hover:border-blue-500/40 hover:bg-blue-500/5">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 group-hover:text-blue-300">{t.label}</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums text-slate-100">{t.total}</span>
                {t.recent > 0
                  ? <span className="text-xs font-semibold text-emerald-400">+{t.recent}</span>
                  : <span className="text-xs text-slate-600">+0</span>}
              </p>
              {t.detail && <p className="mt-0.5 text-[11px] text-slate-500">{t.detail}</p>}
            </Link>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-500">Totals, with how many are new in the last {days === 1 ? 'day' : `${days} days`}. Debates you can’t see aren’t counted.</p>
    </section>
  );
}
