'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Settings = { enabled: boolean; cadence: string; publish_time: string; publish_weekday: number; sections: unknown[]; subscription_id: string | null };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Manage Society: the News at a glance, with the way into its settings
export default function NewsCard({ societyId, switchedOff }: { societyId: number; switchedOff: boolean }) {
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`/api/societies/${societyId}/news/settings`).then(async r => r.ok && setS((await r.json()).settings));
  }, [societyId]);

  async function publish() {
    setBusy(true); setMsg('');
    const r = await fetch(`/api/societies/${societyId}/news/publish`, { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? 'Publishing: the new edition will appear on the News tab in a minute or two.' : d.error ?? 'Could not publish.');
  }

  const configured = !!s?.subscription_id && s.sections.length > 0;
  return (
    <div className="rounded-2xl border border-slate-800 bg-dr-card p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-200">News</h2>
        {s && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] ${configured && s.enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/50 text-slate-400'}`}>
            {!configured ? 'Not set up' : s.enabled ? 'On' : 'Paused'}
          </span>
        )}
      </div>
      {switchedOff ? (
        <p className="text-xs text-slate-500">News is switched off for this Society in Features above. Switch it on to set it up.</p>
      ) : !s ? <p className="text-xs text-slate-500">Loading…</p> : (
        <>
          <p className="mb-4 text-xs leading-relaxed text-slate-400">
            {configured
              ? <>A {s.cadence} edition{s.cadence === 'weekly' ? ` every ${DAYS[s.publish_weekday] ?? ''}` : ''} at {s.publish_time} (UK time), with {s.sections.length} section{s.sections.length === 1 ? '' : 's'}.</>
              : 'A regular magazine of stories on your Society’s topics. Choose its sections (each described by search phrases), places and schedule.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/society/${societyId}/news/settings`} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">
              {configured ? 'News settings' : 'Set up News'}
            </Link>
            {configured && <Link href={`/society/${societyId}/news`} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800">View editions</Link>}
            {configured && s.enabled && (
              <button onClick={publish} disabled={busy} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
                {busy ? 'Publishing…' : 'Publish an edition now'}
              </button>
            )}
          </div>
          {msg && <p className="mt-2 text-xs text-slate-400">{msg}</p>}
        </>
      )}
    </div>
  );
}
