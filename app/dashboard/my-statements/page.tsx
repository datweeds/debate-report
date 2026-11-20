'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { STAT_BADGE, STAT_LABEL } from '@/components/chamber/constants';

type Warning = { severity: 'critical' | 'major' | 'minor' | 'suggestion'; observation: string; recommendation: string };
type Statement = {
  id: string; stat_ref: string | null; stat_type: string; stat_direction: string | null;
  stat_title: string; created_at: string; retracted_at: string | null;
  resolution_id: string; resolution_title: string; society_name: string | null;
  warnings: Warning[];
};

const SEV_CLS: Record<Warning['severity'], string> = {
  critical: 'text-red-300', major: 'text-orange-300', minor: 'text-amber-300', suggestion: 'text-sky-300',
};

export default function MyStatementsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Statement[] | null>(null);
  const [onlyWarnings, setOnlyWarnings] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login?next=/dashboard/my-statements');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/user/statements').then(r => r.ok ? r.json() : { statements: [] })
      .then(d => setItems(d.statements ?? [])).catch(() => setItems([]));
  }, [user]);

  if (authLoading || !user) return null;
  const shown = (items ?? []).filter(s => !onlyWarnings || s.warnings.length > 0);
  const withWarnings = (items ?? []).filter(s => s.warnings.length > 0).length;

  return (
    <div className="px-4 sm:px-8 py-10 max-w-3xl mx-auto">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">My Statements</h1>
          <p className="text-sm text-slate-500 mt-1">Everything you have written, with quality checks you may want to act on.</p>
        </div>
        {withWarnings > 0 && (
          <button onClick={() => setOnlyWarnings(v => !v)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${onlyWarnings ? 'border-amber-500/50 bg-amber-500/10 text-amber-300' : 'border-slate-700 text-slate-400'}`}>
            {onlyWarnings ? 'Show all' : `With checks to review (${withWarnings})`}
          </button>
        )}
      </div>

      {items === null ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-slate-800/40 animate-pulse" />)}</div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-dr-card p-10 text-center text-sm text-slate-500">
          {items.length === 0 ? "You haven't written any statements yet." : 'No statements with checks to review.'}
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map(s => (
            <li key={s.id} className="rounded-xl border border-slate-800 bg-dr-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {s.stat_ref && <span className="font-mono font-bold text-slate-300">{s.stat_ref}</span>}
                <span className={`rounded px-1.5 py-0.5 font-bold border ${STAT_BADGE[s.stat_type] ?? STAT_BADGE.claim}`}>{STAT_LABEL[s.stat_type] ?? s.stat_type}</span>
                {s.stat_direction && <span className="text-slate-500">{s.stat_direction === 'for' ? 'For' : 'Against'}</span>}
                {s.retracted_at && <span className="text-slate-500 line-through">Retracted</span>}
                <span className="ml-auto text-slate-600">{new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <Link href={`/chamber?resolution=${s.resolution_id}&statement=${s.id}`} className="mt-2 block text-sm font-medium text-slate-200 hover:text-blue-300">
                {s.stat_title}
              </Link>
              <p className="mt-0.5 text-xs text-slate-500 truncate">{s.society_name ? `${s.society_name} · ` : ''}{s.resolution_title}</p>
              {s.warnings.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                  {s.warnings.map((w, i) => (
                    <li key={i} className="text-xs leading-snug">
                      <span className={`font-semibold ${SEV_CLS[w.severity]}`}>{w.observation}</span>{' '}
                      <span className="text-slate-400">{w.recommendation}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
