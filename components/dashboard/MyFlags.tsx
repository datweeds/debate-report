'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Flag = {
  id: string; reason: string | null; created_at: string;
  statement_id: string; stat_ref: string | null; stat_title: string;
  resolution_id: string; resolution_title: string;
};

function FlagList({ title, empty, flags }: { title: string; empty: string; flags: Flag[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-300 mb-2">{title}</h2>
      {flags.length === 0 ? (
        <p className="text-xs text-slate-600 rounded-xl border border-slate-800 bg-[#0c1322] px-4 py-3">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {flags.map(f => (
            <li key={f.id} className="rounded-xl border border-slate-800 bg-[#0c1322] px-4 py-3">
              <div className="flex items-center gap-2 text-xs">
                <Link href={`/chamber?resolution=${f.resolution_id}&statement=${f.statement_id}`} className="truncate text-slate-200 hover:text-blue-300">
                  {f.stat_ref && <span className="font-mono font-bold text-slate-400 mr-1">{f.stat_ref}</span>}{f.stat_title}
                </Link>
                <span className="ml-auto shrink-0 text-slate-600">{new Date(f.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </div>
              {f.reason && <p className="mt-1 text-xs text-slate-400">Reason: {f.reason}</p>}
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
  useEffect(() => {
    fetch('/api/user/flags').then(r => r.ok ? r.json() : null).then(setData).catch(() => {});
  }, []);
  if (!data) return null;
  return (
    <div className="mt-10 space-y-6">
      <FlagList title="Flags on your statements" empty="No one has flagged your statements." flags={data.against} />
      <FlagList title="Flags you raised" empty="You haven't flagged any statements." flags={data.raised} />
    </div>
  );
}
