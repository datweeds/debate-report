'use client';

import { useEffect, useState } from 'react';
import { checkDraft, type Draft, type Finding, type QDebate } from '@/lib/quality/rules';

const SEV_CLS: Record<Finding['severity'], string> = {
  critical:   'text-red-300',
  major:      'text-orange-300',
  minor:      'text-amber-300',
  suggestion: 'text-sky-300',
};

// Live quality checks for a statement being written. Advisory only: never
// blocks saving. Same rules as the Debate Quality Report.
export default function DraftWarnings({ draft, debate }: { draft: Draft; debate?: QDebate | null }) {
  const [findings, setFindings] = useState<Finding[]>([]);

  const { id, stat_ref, stat_type, stat_direction, stat_title, stat_description } = draft;
  useEffect(() => {
    if (!debate || !stat_title.trim()) { setFindings([]); return; }
    const t = setTimeout(() => setFindings(checkDraft(
      { id, stat_ref, stat_type, stat_direction, stat_title, stat_description }, debate,
    )), 400);
    return () => clearTimeout(t);
  }, [id, stat_ref, stat_type, stat_direction, stat_title, stat_description, debate]);

  if (!findings.length) return null;
  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300/90 mb-1.5">
        Quality checks <span className="font-normal normal-case tracking-normal text-slate-500">· advice only, you can still save</span>
      </p>
      <ul className="space-y-1.5">
        {findings.slice(0, 6).map(f => (
          <li key={f.fingerprint} className="text-xs leading-snug">
            <span className={`font-semibold ${SEV_CLS[f.severity]}`}>{f.observation.charAt(0).toUpperCase() + f.observation.slice(1)}</span>{' '}
            <span className="text-slate-400">{f.recommendation}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
