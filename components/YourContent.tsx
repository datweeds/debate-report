'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Item = { id: string; text: string; sub: string | null; society: string | null; href: string | null; at: string; isNew: boolean; status?: string | null };

// A request's or invitation's decision, as a coloured badge
function StatusBadge({ status }: { status: string }) {
  const tone = /^(Approved|Accepted)$/.test(status) ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
    : /^(Rejected|Declined)$/.test(status) ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
    : 'border-amber-500/40 bg-amber-500/15 text-amber-300';
  return <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{status}</span>;
}
type Section = { key: string; label: string; total: number; recent: number; items: Item[]; error?: boolean };

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86400e3));
const PERIODS = [{ label: 'day', days: 1 }, { label: '7 days', days: 7 }, { label: '30 days', days: 30 }, { label: '90 days', days: 90 }, { label: 'year', days: 365 }];
const when = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Everything you've contributed, by kind, with what's new since a chosen date
export default function YourContent() {
  const [since, setSince] = useState(daysAgo(7));
  const [sections, setSections] = useState<Section[] | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSections(null);
    fetch(`/api/user/content?since=${since}`).then(async r => r.ok && setSections((await r.json()).sections));
  }, [since]);
  // Opening this page clears the menu's My Content badge
  useEffect(() => {
    try { localStorage.setItem('dr_content_seen', String(Date.now())); } catch {}
    window.dispatchEvent(new Event('dr:alerts-changed'));
  }, []);

  const withContent = sections?.filter(s => s.total > 0) ?? [];
  const empty = sections?.filter(s => s.total === 0) ?? [];
  const toggle = (k: string) => setOpen(o => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">My content</h1>
          <p className="mt-1 text-sm text-slate-400">Everything you’ve contributed across your Societies. Headers show <span className="text-slate-300">(total, +new)</span>.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs" role="group" aria-label="New since">
          <span className="mr-1 text-slate-500">New in the last</span>
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => setSince(daysAgo(p.days))}
              className={`rounded-md px-2 py-1 ${since === daysAgo(p.days) ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>{p.label}</button>
          ))}
          <input type="date" value={since} max={isoDay(new Date())} onChange={e => e.target.value && setSince(e.target.value)} aria-label="New since"
            className="rounded-md border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-200" />
        </div>
      </div>

      {!sections ? <div className="h-64 animate-pulse rounded-2xl bg-slate-800/40" /> : withContent.length === 0 ? (
        <div className="dr-panel rounded-2xl p-10 text-center text-sm text-slate-400">Nothing yet. Join a Society and take part: your debates, votes, messages and more will be listed here.</div>
      ) : (
        <div className="space-y-2">
          {withContent.map(s => {
            const isOpen = open.has(s.key);
            return (
              <section key={s.key} className="dr-panel overflow-hidden rounded-xl">
                <button onClick={() => toggle(s.key)} aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-500/5">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                    <span className={`text-xs text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                    {s.label}
                    {/* The latest decision, at a glance */}
                    {s.items[0]?.status && <StatusBadge status={s.items[0].status} />}
                  </span>
                  <span className="tabular-nums text-sm text-slate-300">
                    ({s.total}, <span className={s.recent ? 'font-semibold text-emerald-400' : 'text-slate-500'}>+{s.recent}</span>)
                  </span>
                </button>
                {isOpen && (
                  <ul className="divide-y divide-slate-700/40 border-t border-slate-700/40">
                    {s.items.map(i => {
                      const body = (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <p className="line-clamp-2 text-sm text-slate-200">{i.isNew && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" title="New" />}{i.text || '(no text)'}</p>
                            {i.status && <StatusBadge status={i.status} />}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{[i.sub, i.society, when(i.at)].filter(Boolean).join(' · ')}</p>
                        </>
                      );
                      return (
                        <li key={i.id}>
                          {i.href ? <Link href={i.href} className="block px-4 py-2.5 transition-colors hover:bg-blue-500/5">{body}</Link> : <div className="px-4 py-2.5">{body}</div>}
                        </li>
                      );
                    })}
                    {s.total > s.items.length && <li className="px-4 py-2 text-xs text-slate-500">Showing the latest {s.items.length} of {s.total}.</li>}
                  </ul>
                )}
              </section>
            );
          })}
          {empty.length > 0 && <p className="pt-2 text-xs text-slate-500">Nothing yet in: {empty.map(s => s.label.toLowerCase()).join(', ')}.</p>}
        </div>
      )}
    </div>
  );
}
