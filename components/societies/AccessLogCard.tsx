'use client';

import { useEffect, useState } from 'react';

type Entry = { id: string; sysadmin: string | null; reason: string; created_at: string; expires_at: string; ended_at: string | null };
const fmt = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Manage Society: privacy, and every Sys Admin emergency access to this Society
export default function AccessLogCard({ societyId, visibility, allowSealed }: { societyId: number; visibility: string; allowSealed: boolean }) {
  const [log, setLog] = useState<Entry[] | null>(null);
  useEffect(() => {
    fetch(`/api/manage/societies/${societyId}/access-log`).then(r => r.ok ? r.json() : { log: [] }).then(d => setLog(d.log));
  }, [societyId]);
  const priv = visibility !== 'public';
  const [sealed, setSealed] = useState(allowSealed);
  const [saving, setSaving] = useState(false);
  async function toggleSealed(on: boolean) {
    if (on && !confirm('Allow members to create Sealed discussions? Only members can read them, end-to-end encrypted: not new.vote, and not you as an admin unless you are a member with secure access set up. AI, abuse scanning and Sys Admin emergency access don’t work inside them, and lost keys can’t be recovered by us.')) return;
    setSaving(true);
    const r = await fetch(`/api/manage/societies/${societyId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ allow_sealed: on }) });
    setSaving(false);
    if (r.ok) setSealed(on);
  }
  return (
    <div className="rounded-2xl border border-slate-800 bg-dr-card p-5">
      <h2 className="text-sm font-semibold text-slate-200">Privacy</h2>
      <p className="mt-2 text-xs text-slate-400">
        {priv
          ? 'This Society is private. Its debates, polls, discussions, documents (including files and folder names), events, projects, principles and flagged content are stored encrypted with its own key. Sys Admin can only see them during logged emergency access, listed below. Encryption protects stored data and backups; the site itself decrypts content to show it to members.'
          : 'This Society is public, so most of its content is stored unencrypted. Discussions (members only) and poll ballots are always encrypted, and so are any Apply or Invite debates. Making the Society private (Who can see it, above) encrypts all its debates, polls, discussions, documents, events, projects, principles and flagged content with its own key, and limits Sys Admin to logged emergency access.'}
      </p>
      <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-800 p-3">
        <input type="checkbox" checked={sealed} disabled={saving} onChange={e => toggleSealed(e.target.checked)} className="mt-0.5 accent-emerald-500" />
        <span className="text-xs text-slate-300">
          <span className="font-semibold text-slate-100">🔐 Allow Sealed discussions</span>
          <span className="mt-1 block text-slate-400">
            Members can choose to seal a discussion: end-to-end encrypted in members’ browsers, so only members can read it, not new.vote.
            Inside a sealed discussion there is no AI, abuse scanning or Sys Admin emergency access, and each member keeps a recovery phrase.
            Turning this off later doesn’t unseal existing discussions.
          </span>
        </span>
      </label>
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
