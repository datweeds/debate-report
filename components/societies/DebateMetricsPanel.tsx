'use client';

import { useEffect, useState } from 'react';
import { STAT_LABEL } from '@/components/chamber/constants';

type Count = { total: number; recent: number };
type Data = { debates: Count; votes: Count; statements: ({ type: string } & Count)[] };
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const PLURAL: Record<string, string> = { evidence: 'Evidence' };

// A Society's Debate page: its debates in numbers, "total / new since <date>".
export default function DebateMetricsPanel({ societyId }: { societyId: number }) {
  const [since, setSince] = useState(() => isoDay(new Date(Date.now() - 7 * 86400e3)));
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    setD(null);
    fetch(`/api/societies/${societyId}/metrics/debates?since=${since}`).then(async r => r.ok && setD(await r.json()));
  }, [societyId, since]);

  const Row = ({ label, c, sub }: { label: string; c: Count; sub?: boolean }) => (
    <li className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className={`text-[11px] font-semibold uppercase tracking-wider ${sub ? 'pl-3 text-slate-500' : 'text-slate-400'}`}>{label}</span>
      <span className="tabular-nums text-slate-200">{c.total}<span className={c.recent ? 'text-emerald-300' : 'text-slate-500'}> / {c.recent} new</span></span>
    </li>
  );
  return (
    <div className="dr-panel rounded-2xl p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-200">Debate metrics</p>
        <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
          new since
          <input type="date" value={since} max={isoDay(new Date())} onChange={e => e.target.value && setSince(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[11px] text-slate-200" />
        </label>
      </div>
      {!d ? <div className="h-48 animate-pulse rounded-lg bg-slate-800/40" /> : (
        <ul className="divide-y divide-slate-700/40">
          <Row label="Debates" c={d.debates} />
          <Row label="Votes" c={d.votes} />
          <li className="pt-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Statements</li>
          {d.statements.map(s => <Row key={s.type} sub label={PLURAL[s.type] ?? `${STAT_LABEL[s.type] ?? s.type}s`} c={s} />)}
        </ul>
      )}
    </div>
  );
}
