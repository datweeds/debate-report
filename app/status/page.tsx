import Link from 'next/link';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getSession } from '@/lib/auth';
import { runChecks, incidents, type Health } from '@/lib/status';
import { NewIncident, UpdateIncident } from '@/components/status/IncidentAdmin';

export const metadata: Metadata = { title: 'Status', description: 'Whether new.vote is working, and any incidents or planned maintenance.' };

const DOT: Record<Health, string> = { ok: 'bg-emerald-400', degraded: 'bg-amber-400', down: 'bg-rose-500' };
const WORD: Record<Health, string> = { ok: 'Working', degraded: 'Partly working', down: 'Not working' };
const IMPACT: Record<string, string> = { outage: 'Outage', degraded: 'Degraded', maintenance: 'Planned maintenance', security: 'Security' };
const STATE: Record<string, string> = { scheduled: 'Scheduled', investigating: 'Investigating', identified: 'Cause found', monitoring: 'Fixed; monitoring', resolved: 'Resolved' };
const when = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

export default async function StatusPage() {
  await connection();
  const [checks, inc, session] = await Promise.all([runChecks(), incidents(), getSession().catch(() => null)]);
  const worst: Health = checks.some(c => c.health === 'down') ? 'down' : checks.some(c => c.health === 'degraded') || inc.open.some(i => i.impact !== 'maintenance') ? 'degraded' : 'ok';
  const headline = worst === 'ok' ? 'All systems working' : worst === 'down' ? 'Part of new.vote isn’t working' : 'Some things aren’t working fully';
  return (
    <div className="min-h-screen bg-dr-base px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <div className="mb-4 flex items-center gap-2 text-sm text-slate-500"><Link href="/" className="hover:text-slate-300">Home</Link><span>/</span><span className="text-slate-300">Status</span></div>
          <h1 className="text-4xl font-bold text-slate-100">Status</h1>
          <p className="mt-2 text-sm text-slate-500">Checked {when(new Date().toISOString())} (UK time). Refresh the page to check again.</p>
        </div>

        <div className={`flex items-center gap-3 rounded-2xl border p-5 ${worst === 'ok' ? 'border-emerald-700/50 bg-emerald-950/20' : worst === 'down' ? 'border-rose-700/50 bg-rose-950/20' : 'border-amber-700/50 bg-amber-950/20'}`}>
          <span className={`h-3 w-3 rounded-full ${DOT[worst]}`} />
          <p className="text-lg font-semibold text-slate-100">{headline}</p>
        </div>

        {inc.open.map(i => (
          <div key={i.id} className="card-dr p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">{IMPACT[i.impact]} · {STATE[i.state]}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">{i.title}</h2>
            {i.body && <p className="mt-2 whitespace-pre-line text-sm text-slate-300">{i.body}</p>}
            <p className="mt-2 text-xs text-slate-500">{i.state === 'scheduled' ? `Starts ${when(i.started_at)}` : `Started ${when(i.started_at)}`} · updated {when(i.updated_at)}</p>
            {session?.isSysAdmin && <UpdateIncident id={i.id} state={i.state} />}
          </div>
        ))}

        <div className="card-dr divide-y divide-slate-800/70 p-2">
          {checks.map(c => (
            <div key={c.key} className="flex items-start justify-between gap-4 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-200">{c.name}</p>
                <p className="text-xs text-slate-500">{c.what}</p>
                {c.note && <p className="mt-1 text-xs text-amber-300/90">{c.note}</p>}
              </div>
              <span className="flex shrink-0 items-center gap-2 text-sm text-slate-300"><span className={`h-2.5 w-2.5 rounded-full ${DOT[c.health]}`} />{WORD[c.health]}</span>
            </div>
          ))}
        </div>

        {inc.recent.length > 0 && (
          <div className="card-dr p-5">
            <h2 className="text-sm font-semibold text-slate-200">Resolved in the last 30 days</h2>
            <ul className="mt-3 space-y-3">
              {inc.recent.map(i => (
                <li key={i.id} className="text-sm">
                  <p className="text-slate-200">{i.title} <span className="text-xs text-slate-500">· {IMPACT[i.impact]}</span></p>
                  {i.body && <p className="whitespace-pre-line text-xs text-slate-400">{i.body}</p>}
                  <p className="text-xs text-slate-500">{when(i.started_at)} to {when(i.resolved_at!)}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {session?.isSysAdmin && <NewIncident />}

        <p className="text-sm text-slate-400">
          If this page won&apos;t load, new.vote itself is probably down. How we handle incidents and tell you about them is in our{' '}
          <Link href="/service#incidents" className="text-blue-400 hover:underline">service description</Link>. To report a problem, email{' '}
          <a href="mailto:contact@new.vote" className="text-blue-400 hover:underline">contact@new.vote</a>; for a security problem, see the{' '}
          <Link href="/security" className="text-blue-400 hover:underline">Security page</Link>.
        </p>
      </div>
    </div>
  );
}
