'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Flag = {
  id: string; reason: string | null; created_at: string; resolved_at: string | null;
  statement_id: string; stat_ref: string | null; stat_title: string;
  resolution_id: string; resolution_title: string;
};

function FlagList({ title, empty, flags, onWithdraw }: { title: string; empty: string; flags: Flag[]; onWithdraw?: (f: Flag) => void }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-300 mb-2">{title}</h2>
      {flags.length === 0 ? (
        <p className="text-xs text-slate-600 rounded-xl border border-slate-800 bg-dr-card px-4 py-3">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {flags.map(f => (
            <li key={f.id} className="rounded-xl border border-slate-800 bg-dr-card px-4 py-3">
              <div className="flex items-center gap-2 text-xs">
                <Link href={`/chamber?resolution=${f.resolution_id}&statement=${f.statement_id}`} className="truncate text-slate-200 hover:text-blue-300">
                  {f.stat_ref && <span className="font-mono font-bold text-slate-400 mr-1">{f.stat_ref}</span>}{f.stat_title}
                </Link>
                {f.resolved_at && <span className="ml-auto shrink-0 rounded-full border border-emerald-600/40 bg-emerald-600/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300" title="A Society Admin reviewed this flag and closed it">Cleared</span>}
                <span className={`${f.resolved_at ? '' : 'ml-auto '}shrink-0 text-slate-600`}>{new Date(f.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs">
                {f.reason && <p className="text-slate-400">Reason: {f.reason}</p>}
                {onWithdraw && !f.resolved_at && (
                  <button onClick={() => onWithdraw(f)} title="Take back this flag" className="ml-auto text-slate-500 hover:text-rose-300">Withdraw</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Flags the user raised, and flags raised by others on the user's statements.
export default function MyFlags() {
  const [data, setData] = useState<{ raised: Flag[]; against: Flag[] } | null>(null);
  const load = () => fetch('/api/user/flags').then(r => r.ok ? r.json() : null).then(setData).catch(() => {});
  useEffect(() => { void load(); }, []);
  // Take back a flag you raised (removes it)
  async function withdraw(f: Flag) {
    if (!window.confirm('Withdraw this flag?')) return;
    const r = await fetch(`/api/statements/${f.statement_id}/flag`, { method: 'DELETE' });
    if (r.ok) { void load(); window.dispatchEvent(new Event('dr:alerts-changed')); }
  }
  if (!data) return null;
  return (
    <div className="mt-10 space-y-6">
      <FlagList title="Flags on your statements" empty="No one has flagged your statements." flags={data.against} />
      <FlagList title="Flags you raised" empty="You haven't flagged any statements." flags={data.raised} onWithdraw={withdraw} />
    </div>
  );
}
