'use client';

import { useEffect, useState } from 'react';

type Entry = { id: string; sysadmin: string | null; reason: string; created_at: string; expires_at: string; ended_at: string | null };
const fmt = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Manage Society: privacy, and every Sys Admin emergency access to this Society
export default function AccessLogCard({ societyId, visibility }: { societyId: number; visibility: string }) {
  const [log, setLog] = useState<Entry[] | null>(null);
  useEffect(() => {
    fetch(`/api/manage/societies/${societyId}/access-log`).then(r => r.ok ? r.json() : { log: [] }).then(d => setLog(d.log));
  }, [societyId]);
  const priv = visibility !== 'public';
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-5">
      <h2 className="text-sm font-semibold text-slate-200">Privacy</h2>
      <p className="mt-2 text-xs text-slate-400">
        {priv
          ? 'This Society is private. Its discussions, documents (including uploaded files) and flagged content are stored encrypted with its own key. Sys Admin can only see them during logged emergency access, listed below. Encryption protects stored data and backups; the site itself decrypts content to show it to members.'
          : 'This Society is public, so its content is stored unencrypted. Making it private (Who can see it, above) encrypts its stored discussions, documents and flagged content with its own key, and limits Sys Admin to logged emergency access.'}
      </p>
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Sys Admin emergency access</h3>
      {!log ? <div className="mt-2 h-8 rounded bg-slate-800/40 animate-pulse" /> : log.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">None.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-xs">
          {log.map(e => (
            <li key={e.id} className="border-b border-slate-800/60 pb-2 last:border-0">
              <p className="text-slate-300">{fmt(e.created_at)} · @{e.sysadmin ?? '?'} · until {fmt(e.ended_at ?? e.expires_at)}{e.ended_at ? ' (ended early)' : ''}</p>
              <p className="text-slate-400">Reason: {e.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
