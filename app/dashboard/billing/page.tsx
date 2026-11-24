'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type Price = {
  lookupKey: string; plan: string; for: 'user' | 'society'; product: string; description: string | null;
  amount: number | null; currency: string; interval: string | null; intervalCount: number | null;
};
type Sub = { id: string; status: string; plan: string | null; lookup_key: string | null; current_period_end: string | null; cancel_at_period_end: boolean; trial_end: string | null };
type Limits = { societies: number; storageBytes: number; aiUsdMonth: number; maxFileBytes: number; meetMinutes: number | null; meetParticipants: number;
  aiStandard: boolean; votingCodes: boolean; recurringEvents: boolean; formalBallots: boolean; support: string };
type Status = {
  hasAccount: boolean; subscriptions: Sub[]; enforced: boolean; onSale: boolean; sysAdmin: boolean;
  plan: { plan: string; name: string; source: string; until: string | null; limits: Limits };
  usage: { storage: number; ai: number; societies: number };
  warnings: { measure: string; level: number; text: string }[];
  societies: { id: number; name: string; held: boolean; closed: boolean; members: number; storage: number }[];
  others: { id: number; name: string; owner: string | null }[];
};

const LIVE = ['active', 'trialing', 'past_due'];
const STATUS_LABEL: Record<string, string> = { active: 'Active', trialing: 'Free trial', past_due: 'Payment overdue' };
const bytes = (n: number) => (n >= 1024 ** 3 ? `${+(n / 1024 ** 3).toFixed(1)} GB` : n >= 1024 ** 2 ? `${Math.round(n / 1024 ** 2)} MB` : `${Math.max(0, Math.round(n / 1024))} KB`);
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
function money(p: Price) {
  if (p.amount == null) return '';
  const v = new Intl.NumberFormat('en-GB', { style: 'currency', currency: p.currency.toUpperCase() }).format(p.amount / 100);
  return p.interval ? `${v} a ${p.interval}` : v;
}

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

// Your plan: it covers every Society you own, with storage and AI shared across them.
export default function BillingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [s, setS] = useState<Status | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [swap, setSwap] = useState<Record<number, number>>({});

  useEffect(() => { if (!loading && !user) router.push('/login?next=/dashboard/billing'); }, [loading, user, router]);
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      fetch('/api/billing/status', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)),
      fetch('/api/billing/prices').then(r => r.json()).catch(() => ({ prices: [] })),
    ]);
    setS(a); setPrices((b.prices ?? []).filter((p: Price) => p.for === 'user'));
  }, []);
  useEffect(() => { if (user) void load(); }, [user, load]);

  async function post(path: string, key: string, body: Record<string, unknown>) {
    setBusy(key); setError('');
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? 'Something went wrong'); return null; }
      return d;
    } finally { setBusy(''); }
  }
  async function checkout(p: Price) {
    const d = await post('/api/billing/checkout', `buy-${p.lookupKey}`, { lookupKey: p.lookupKey, returnPath: '/dashboard/billing' });
    if (d?.url) window.location.href = d.url;
  }
  async function portal() {
    const d = await post('/api/billing/portal', 'portal', { returnPath: '/dashboard/billing' });
    if (d?.url) window.location.href = d.url;
  }
  async function switchTo(p: Price) {
    if (!confirm(`Switch to ${p.product.replace(/^new\.vote /, '')}, ${money(p)}? Stripe charges or credits the difference straight away.`)) return;
    if (await post('/api/billing/switch', `switch-${p.lookupKey}`, { lookupKey: p.lookupKey })) void load();
  }
  async function activate(id: number) {
    if (await post(`/api/manage/societies/${id}/hold`, `act-${id}`, { action: 'activate', instead: swap[id] ?? null })) void load();
  }

  if (loading || !user) return null;
  if (!s) return <div className="mx-auto max-w-2xl px-6 py-8"><div className="h-40 animate-pulse rounded-2xl bg-slate-800/40" /></div>;
  const l = s.plan.limits;
  const live = s.subscriptions.filter(x => LIVE.includes(x.status));
  const current = live[0] ?? null;
  const plans = [...new Set(prices.sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0)).map(p => p.plan))];
  const activeSocs = s.societies.filter(x => !x.held && !x.closed);

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Plans &amp; billing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your plan covers every Society you own. Storage and AI are shared across them, and members never pay. Payments, cards and invoices are handled by Stripe.
        </p>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-dr-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Your plan</p>
            <p className="text-2xl font-bold text-slate-100">{s.plan.name}</p>
            {current && (
              <p className="text-xs text-slate-400">
                {STATUS_LABEL[current.status] ?? current.status} · {current.cancel_at_period_end ? `ends ${day(current.current_period_end)}` : `renews ${day(current.current_period_end)}`}
              </p>
            )}
            {s.plan.source === 'grant' && <p className="text-xs text-slate-400">Given by new.vote{s.plan.until ? ` until ${day(s.plan.until)}` : ''}.</p>}
          </div>
          {s.hasAccount && (
            <button onClick={portal} disabled={!!busy} className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-600 disabled:opacity-50">
              {busy === 'portal' ? 'Opening…' : 'Invoices, card, cancel'}
            </button>
          )}
        </div>
        {s.plan.source === 'grace' && s.plan.until && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Your paid plan has ended. You keep {s.plan.name} until {day(s.plan.until)}, then move to Pod, the free plan. Choose a plan below to keep it.
          </p>
        )}
        {s.warnings.map(w => (
          <p key={w.measure} className={`rounded-lg border px-3 py-2 text-xs ${w.level === 100 ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>{w.text}</p>
        ))}
        {!s.enforced && <p className="text-xs text-slate-500">Limits aren’t applied yet: everything is unlimited for now.</p>}
        <Meter label="Societies" used={s.usage.societies} limit={l.societies} fmt={n => String(n)} />
        <Meter label="Storage, shared" used={s.usage.storage} limit={l.storageBytes} fmt={bytes} />
        <Meter label="Platform AI this month, shared" used={s.usage.ai} limit={l.aiUsdMonth} fmt={n => `$${n.toFixed(2)}`} />
        <p className="text-xs text-slate-500">
          Every Society you own: files up to {bytes(l.maxFileBytes)} · calls {l.meetMinutes ? `up to ${l.meetMinutes} minutes` : 'of any length'}, {l.meetParticipants} people
          · {l.aiStandard ? 'Quality Reports and AI helper' : 'live quality checks only'}
          {l.votingCodes ? ' · voting codes' : ''}{l.recurringEvents ? ' · repeating events' : ''}{l.formalBallots ? ' · formal ballots' : ''} · support: {l.support}.{' '}
          <Link href="/pricing" className="text-blue-400 hover:underline">Compare plans</Link>
        </p>
      </section>

      {prices.length === 0 ? (
        <p className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">Paid plans aren’t on sale yet. Everything is free for now.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map(plan => {
            const ps = prices.filter(p => p.plan === plan).sort((a, b) => (a.interval === 'month' ? 0 : 1) - (b.interval === 'month' ? 0 : 1));
            return (
              <div key={plan} className={`rounded-xl border p-4 ${current?.plan === plan ? 'border-emerald-500/40' : 'border-slate-800'}`}>
                <p className="font-semibold text-slate-100">{ps[0].product.replace(/^new\.vote /, '')}{current?.plan === plan && <span className="ml-2 text-xs font-normal text-emerald-300">your plan</span>}</p>
                {ps[0].description && <p className="mt-1 text-xs text-slate-500">{ps[0].description}</p>}
                <div className="mt-3 space-y-2">
                  {ps.map(p => current?.lookup_key === p.lookupKey ? (
                    <p key={p.lookupKey} className="rounded-lg border border-emerald-500/30 px-3 py-2 text-center text-sm text-emerald-300">{money(p)}: your plan</p>
                  ) : (
                    <button key={p.lookupKey} disabled={!!busy} onClick={() => (current ? switchTo(p) : checkout(p))}
                      className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${current ? 'border border-slate-600 text-slate-200 hover:border-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}>
                      {busy.endsWith(p.lookupKey) ? '…' : `${current ? 'Switch to ' : ''}${money(p)}${p.interval === 'year' ? ' (2 months free)' : ''}`}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {current && <p className="text-xs text-slate-500 sm:col-span-2">To go back to Pod, cancel from “Invoices, card, cancel”: your plan runs to the end of the period you’ve paid for, then 30 days more.</p>}
        </div>
      )}

      <section className="rounded-2xl border border-slate-800 bg-dr-card p-6">
        <h2 className="text-sm font-semibold text-slate-200">Your Societies <span className="font-normal text-slate-500">({activeSocs.length} of {l.societies} on {s.plan.name})</span></h2>
        {s.societies.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">You don’t own a Society yet. <Link href="/dashboard/societies" className="text-blue-400 hover:underline">Start one</Link>.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800/60 text-sm">
            {s.societies.map(x => (
              <li key={x.id} id={`society-${x.id}`} className="space-y-2 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/dashboard/societies?society=${x.id}`} className="text-slate-200 hover:underline">{x.name}</Link>
                  <span className={`text-xs ${x.held ? 'text-amber-300' : 'text-slate-500'}`}>
                    {x.closed ? 'closed' : x.held ? 'read-only' : 'active'} · {x.members} member{x.members === 1 ? '' : 's'} · {bytes(x.storage)}
                  </span>
                </div>
                {x.held && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-amber-200">
                    Over your plan’s {l.societies} Societies.
                    {activeSocs.length >= l.societies && (
                      <select value={swap[x.id] ?? ''} onChange={e => setSwap({ ...swap, [x.id]: Number(e.target.value) })}
                        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200" aria-label="Make this one read-only instead">
                        <option value="">Instead of…</option>
                        {activeSocs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    )}
                    <button disabled={!!busy || (activeSocs.length >= l.societies && !swap[x.id])} onClick={() => activate(x.id)}
                      className="rounded-lg border border-amber-400/50 px-3 py-1 font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-40">Make it active</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {s.others.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-dr-card p-6 text-sm">
          <h2 className="text-sm font-semibold text-slate-200">Societies you help run</h2>
          <p className="mt-1 text-xs text-slate-500">These use their owner’s plan, not yours.</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            {s.others.map(o => <li key={o.id}>{o.name} <span className="text-slate-500">· owner {o.owner ? `@${o.owner}` : 'new.vote'}</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
