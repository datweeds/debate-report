'use client';

import { useState } from 'react';

// Manage Society: run it as a youth group, so members aged 13 to 15 can join its calls
export default function YouthGroupCard({ societyId, initial }: { societyId: number; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);
  async function toggle(v: boolean) {
    if (v && !confirm('Run this Society as a youth group? Members aged 13 to 15 will be able to join its video calls. Make sure a responsible adult runs it, joining is by approval or invitation, and calls are supervised.')) return;
    setSaving(true);
    const r = await fetch(`/api/manage/societies/${societyId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ youth_group: v }) });
    setSaving(false);
    if (r.ok) setOn(v);
  }
  return (
    <div className="rounded-2xl border border-slate-800 bg-dr-card p-5">
      <h2 className="text-sm font-semibold text-slate-200">Young members</h2>
      <p className="mt-2 text-xs text-slate-400">
        Members under 18 are marked <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 text-[10px] font-semibold text-amber-300">Under 18</span> in
        your member list and join requests. They don’t appear on your public About page, and reports involving them are reviewed first.
      </p>
      <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-800 p-3">
        <input type="checkbox" checked={on} disabled={saving} onChange={e => toggle(e.target.checked)} className="mt-0.5 accent-amber-500" />
        <span className="text-xs text-slate-300">
          <span className="font-semibold text-slate-100">Run as a youth group</span>
          <span className="mt-1 block text-slate-400">
            Members aged 13 to 15 can only join video calls in Societies run as youth groups. Turn this on if your Society is for young people
            and its calls are supervised by a responsible adult. Read <a href="/guides/youth-groups" target="_blank" rel="noopener" className="text-blue-400 hover:underline">Running a youth group</a> first.
          </span>
        </span>
      </label>
    </div>
  );
}
