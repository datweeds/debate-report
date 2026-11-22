'use client';

import { useEffect, useState } from 'react';

type Spend = {
  today: number; month: number; dailyCap: number | null; monthlyCap: number | null; newsReachable: boolean;
  days: { day: string; site: number; news: number; scotparl: number }[];
};

const usd = (n: number) => (n > 0 && n < 0.01 ? '<$0.01' : `$${n.toFixed(2)}`);

function Bar({ label, spent, cap }: { label: string; spent: number; cap: number | null }) {
  const pct = cap ? Math.min(100, (spent / cap) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{label}: <span className="font-semibold text-slate-200">{usd(spent)}</span> of {cap != null ? usd(cap) : 'no cap'}</span>
        {cap ? <span className={pct >= 95 ? 'text-rose-300' : pct >= 80 ? 'text-amber-300' : ''}>{pct.toFixed(0)}%</span> : null}
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-800">
        <div className={`h-2 rounded-full ${pct >= 95 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Admin → Analytics: the platform's AI spend today and this month against the
// caps, with a bar per day. Caps are changed in Admin → AI.
export default function AiSpendCard({ onSettings }: { onSettings?: () => void }) {
  const [s, setS] = useState<Spend | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch('/api/admin/ai/spend').then(r => (r.ok ? r.json() : Promise.reject())).then(setS).catch(() => setErr(true));
  }, []);
  if (err) return <div className="card-dr p-6 text-sm text-rose-400">AI spend couldn’t be loaded.</div>;
  if (!s) return <div className="card-dr h-40 animate-pulse p-6" />;
  const max = Math.max(0.01, ...s.days.map(d => d.site + d.news + d.scotparl), s.dailyCap ?? 0);
  return (
    <div className="card-dr space-y-4 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-200">AI spend (platform)</h2>
        {onSettings && <button onClick={onSettings} className="text-xs text-blue-400 hover:underline">Change caps</button>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Bar label="Today" spent={s.today} cap={s.dailyCap} />
        <Bar label={new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })} spent={s.month} cap={s.monthlyCap} />
      </div>
      <div>
        <div className="flex h-24 items-end gap-[3px]" role="img" aria-label="AI spend by day this month">
          {s.days.map(d => {
            const total = d.site + d.news + d.scotparl;
            return (
              <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.day}: ${usd(total)} (News ${usd(d.news)}, site ${usd(d.site)}, ScotParl ${usd(d.scotparl)})`}>
                <div className="w-full rounded-t-sm bg-violet-500/80" style={{ height: `${(d.news / max) * 100}%` }} />
                <div className="w-full bg-blue-500/80" style={{ height: `${(d.site / max) * 100}%` }} />
                <div className="w-full bg-teal-500/80" style={{ height: `${(d.scotparl / max) * 100}%` }} />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-slate-500">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-violet-500/80" />News</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-blue-500/80" />Quality checks, reports, AI helper</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-teal-500/80" />ScotParl analysis</span>
          <span>Days in UTC. Hover a bar for its figures.</span>
        </div>
      </div>
      {!s.newsReachable && <p className="text-xs text-amber-300">The News service isn’t answering, so its spend isn’t included.</p>}
      <p className="text-xs text-slate-500">You’re emailed when spend reaches 95% of either cap. At a cap, platform AI pauses until it resets and features use their non-AI versions. Societies using their own AI key aren’t counted.</p>
    </div>
  );
}
