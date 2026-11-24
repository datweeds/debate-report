'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Limits = { societies: number; storageBytes: number; maxFileBytes: number; aiUsdMonth: number; aiStandard: boolean; meetMinutes: number | null;
  meetParticipants: number; votingCodes: boolean; support: string };
type Plan = { name: string; source: string; until: string | null; enforced: boolean; limits: Limits; held: boolean; isOwner: boolean; ownerHandle: string | null;
  warnings: { measure: string; level: number; text: string }[]; usage: { storageBytes: number; aiUsd: number; societies: number } };

const bytes = (n: number) => (n >= 1024 ** 3 ? `${+(n / 1024 ** 3).toFixed(1)} GB` : n >= 1024 ** 2 ? `${Math.round(n / 1024 ** 2)} MB` : `${Math.max(0, Math.round(n / 1024))} KB`);

function Meter({ label, used, limit, fmt }: { label: string; used: number; limit: number; fmt: (n: number) => string }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400"><span>{label}</span><span>{fmt(used)} of {fmt(limit)}</span></div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-800">
        <div className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// A Society's plan (its owner's), for its admins: shared usage, warnings, read-only.
export default function PlanCard({ societyId }: { societyId: number }) {
  const [p, setP] = useState<Plan | null>(null);
  useEffect(() => { fetch(`/api/societies/${societyId}/plan`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(setP).catch(() => {}); }, [societyId]);
  if (!p) return null;
  const l = p.limits;
  const whose = p.isOwner ? 'your' : p.ownerHandle ? `@${p.ownerHandle}’s` : 'new.vote’s';
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-200">
        Uses {whose} <span className="font-semibold">{p.name}</span> plan{p.usage.societies > 1 ? `, shared across ${p.usage.societies} Societies` : ''}.
        {!p.enforced && <span className="ml-2 text-xs text-slate-500">Limits aren’t applied yet: everything is unlimited for now.</span>}
      </p>
      {p.held && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <strong>Read-only for now:</strong> it’s over the number of Societies the plan covers. Members can still read and export everything.
          {p.isOwner ? ' Make it active from Plans & billing.' : ' Its owner can make it active.'}
        </p>
      )}
      {p.source === 'grace' && p.until && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          The paid plan has ended: it stays on {p.name} until {new Date(p.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}, then moves to Pod.
        </p>
      )}
      {p.warnings.map(w => (
        <p key={w.measure} className={`rounded-lg border px-3 py-2 text-xs ${w.level === 100 ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>{w.text}</p>
      ))}
      <Meter label="Storage, shared" used={p.usage.storageBytes} limit={l.storageBytes} fmt={bytes} />
      <Meter label="Platform AI this month, shared" used={p.usage.aiUsd} limit={l.aiUsdMonth} fmt={n => `$${n.toFixed(2)}`} />
      <p className="text-xs text-slate-500">
        Files up to {bytes(l.maxFileBytes)} · calls {l.meetMinutes ? `up to ${l.meetMinutes} minutes` : 'of any length'}, {l.meetParticipants} people
        · {l.aiStandard ? 'Quality Reports and AI helper' : 'live quality checks only'} · voting codes {l.votingCodes ? 'included' : 'on Team and Network'}.{' '}
        {p.isOwner ? <Link href="/dashboard/billing" className="text-blue-400 hover:underline">Plans &amp; billing</Link> : <Link href="/pricing" className="text-blue-400 hover:underline">Compare plans</Link>}
      </p>
    </div>
  );
}
