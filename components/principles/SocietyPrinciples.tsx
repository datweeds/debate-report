'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import RichText from '@/components/discussions/RichText';
import PrincipleForm, { CATEGORY_META, type PrincipleFields } from './PrincipleForm';

type Review = { id: string; text: string; status: 'pending' | 'under_review'; by: string | null; created_at: string };
type Principle = PrincipleFields & {
  id: string; lineage_id: string; sort_order: number; grounding: string;
  thread_id: string | null; resolution_id: string | null; post_count: number | null;
  vote_total_for: number | null; vote_total_against: number | null; reviews: Review[];
};
type Version = { id: string; version: number; change_note: string | null; is_current: boolean; created_at: string; created_by: string | null };
type Data = { version: Version | null; versions: Version[]; principles: Principle[]; canPost: boolean; canModerate: boolean };
type LibraryItem = PrincipleFields & { id: string };

const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none';
const day = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// A Society's principles: maintained by its moderators, open to discussion,
// review requests and debate by its members.
export default function SocietyPrinciples({ societyId }: { societyId: number }) {
  const router = useRouter();
  const base = `/api/societies/${societyId}/principles`;
  const [data, setData] = useState<Data | null>(null);
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | PrincipleFields['category']>('all');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [library, setLibrary] = useState<LibraryItem[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`${base}${viewVersion ? `?version=${viewVersion}` : ''}`);
    if (r.ok) setData(await r.json()); else setError('Could not load the principles.');
  }, [base, viewVersion]);
  useEffect(() => { load(); }, [load]);

  async function send(url: string, method: string, body?: unknown): Promise<string | null> {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) return (await r.json().catch(() => ({}))).error ?? 'Something went wrong';
    return null;
  }

  async function discuss(p: Principle) {
    setBusy(p.id);
    const r = await fetch(`${base}/${p.id}/discuss`, { method: 'POST' });
    setBusy(null);
    if (!r.ok) { setError((await r.json()).error ?? 'Could not open the discussion'); return; }
    router.push(`/society/${societyId}/discussions/${(await r.json()).threadId}`);
  }

  async function debate(p: Principle) {
    if (!p.resolution_id && !confirm(`Open a debate on "${p.title}"? Members will be able to argue for and against it, and vote.`)) return;
    setBusy(p.id);
    const r = await fetch(`${base}/${p.id}/debate`, { method: 'POST' });
    setBusy(null);
    if (!r.ok) { setError((await r.json()).error ?? 'Could not open the debate'); return; }
    router.push(`/chamber?resolution=${(await r.json()).resolutionId}`);
  }

  async function openLibrary() {
    setPicked(new Set());
    const r = await fetch('/api/principle-library');
    setLibrary(r.ok ? (await r.json()).principles : []);
  }

  if (!data) return error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-40 rounded-2xl bg-slate-800/40 animate-pulse" />;

  const isCurrent = !data.version || data.version.is_current;
  const canEdit = data.canModerate && isCurrent;
  const shown = data.principles.filter(p => filter === 'all' || p.category === filter);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="w-full sm:w-auto sm:flex-1 min-w-0 text-sm text-slate-400">The rules, aspirations and guidelines this Society runs by.</p>
        {data.versions.length > 0 && (
          <select value={data.version?.version ?? ''} onChange={e => setViewVersion(Number(e.target.value))} aria-label="Version"
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300">
            {data.versions.map(v => <option key={v.id} value={v.version}>Version {v.version}{v.is_current ? ' (current)' : ''}</option>)}
          </select>
        )}
        {canEdit && (
          <>
            <button onClick={openLibrary} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500">Copy from library</button>
            {data.principles.length > 0 && (
              <button onClick={() => setPublishing(true)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500">Publish new version</button>
            )}
            <button onClick={() => setAdding(true)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">+ Add principle</button>
          </>
        )}
      </div>

      {data.version && (
        <div className={`rounded-xl border px-4 py-2.5 text-xs ${isCurrent ? 'border-slate-800 bg-[#0c1322] text-slate-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
          {!isCurrent && <span className="font-semibold">You&apos;re viewing an earlier version. </span>}
          Version {data.version.version}, {day(data.version.created_at)}{data.version.created_by ? ` by @${data.version.created_by}` : ''}
          {data.version.change_note ? `: ${data.version.change_note}` : ''}
          {!isCurrent && <button onClick={() => setViewVersion(null)} className="ml-2 underline">Show current</button>}
        </div>
      )}

      {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

      {publishing && (
        <div className="rounded-2xl border border-slate-700 bg-[#0c1322] p-4 space-y-3">
          <p className="text-sm text-slate-200">Publish version {(data.version?.version ?? 0) + 1}</p>
          <p className="text-xs text-slate-500">The current principles are copied into the new version, which you can then edit. Version {data.version?.version} stays readable in the history, and discussions and debates carry over.</p>
          <textarea value={changeNote} onChange={e => setChangeNote(e.target.value)} rows={2} maxLength={2000} placeholder="What changes in this version?" className={inputCls} autoFocus />
          <div className="flex gap-2">
            <button onClick={async () => { const err = await send(`${base}/versions`, 'POST', { changeNote }); if (err) setError(err); else { setPublishing(false); setChangeNote(''); setViewVersion(null); load(); } }}
              disabled={!changeNote.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">Publish</button>
            <button onClick={() => setPublishing(false)} className="px-2 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
          </div>
        </div>
      )}

      {adding && (
        <PrincipleForm saveLabel="Add principle" onCancel={() => setAdding(false)}
          onSave={async p => { const err = await send(base, 'POST', p); if (!err) { setAdding(false); load(); } return err; }} />
      )}

      {library && (
        <div className="rounded-2xl border border-slate-700 bg-[#0c1322] p-4 space-y-3">
          <p className="text-sm text-slate-200">Copy from the general library</p>
          <p className="text-xs text-slate-500">Copied principles become this Society&apos;s own: edit them freely afterwards.</p>
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {library.map(l => (
              <li key={l.id}>
                <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-800 p-3 hover:border-slate-600">
                  <input type="checkbox" checked={picked.has(l.id)} className="mt-1 accent-blue-500"
                    onChange={() => setPicked(s => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })} />
                  <span className="min-w-0">
                    <span className={`mr-2 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${CATEGORY_META[l.category].cls}`}>{CATEGORY_META[l.category].label}</span>
                    <span className="text-sm font-medium text-slate-100">{l.title}</span>
                    <span className="mt-1 block text-xs text-slate-400">{l.body}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button onClick={async () => { const err = await send(`${base}/copy`, 'POST', { libraryIds: [...picked] }); if (err) setError(err); else { setLibrary(null); load(); } }}
              disabled={!picked.size} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">Copy {picked.size || ''} selected</button>
            <button onClick={() => setPicked(new Set(library.map(l => l.id)))} className="px-2 text-sm text-slate-400 hover:text-slate-200">Select all</button>
            <button onClick={() => setLibrary(null)} className="px-2 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
          </div>
        </div>
      )}

      {/* Category filter */}
      {data.principles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(['all', 'rule', 'aspiration', 'guideline'] as const).map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === c ? (c === 'all' ? 'border-slate-400 text-slate-200 bg-slate-700/40' : CATEGORY_META[c].cls) : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>
              {c === 'all' ? `All (${data.principles.length})` : `${CATEGORY_META[c].plural} (${data.principles.filter(p => p.category === c).length})`}
            </button>
          ))}
        </div>
      )}

      {data.principles.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-10 text-center text-sm text-slate-500">
          No principles yet.{canEdit ? ' Add your own, or copy a starting set from the library.' : ''}
        </div>
      ) : (
        <ol className="space-y-3">
          {shown.map(p => {
            const n = data.principles.indexOf(p) + 1;
            return (
              <li key={p.id} className="rounded-2xl border border-slate-800 bg-[#0c1322] p-4">
                {editing === p.id ? (
                  <PrincipleForm initial={p} onCancel={() => setEditing(null)}
                    onSave={async v => { const err = await send(`${base}/${p.id}`, 'PATCH', v); if (!err) { setEditing(null); load(); } return err; }} />
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 w-6 flex-shrink-0 text-right text-sm font-bold text-slate-500">{n}.</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${CATEGORY_META[p.category].cls}`}>{CATEGORY_META[p.category].label}</span>
                          <h3 className="text-base font-semibold text-slate-100">{p.title}</h3>
                        </div>
                        <div className="mt-1.5"><RichText text={p.body} /></div>
                        {p.grounding && <p className="mt-2 text-xs text-slate-400"><span className="font-semibold text-slate-300">Why: </span>{p.grounding}</p>}
                      </div>
                      {canEdit && (
                        <div className="flex flex-shrink-0 flex-col items-end gap-1 text-xs">
                          <span className="flex gap-1">
                            <button onClick={async () => { await send(`${base}/${p.id}`, 'PATCH', { move: 'up' }); load(); }} aria-label="Move up" className="rounded px-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200">↑</button>
                            <button onClick={async () => { await send(`${base}/${p.id}`, 'PATCH', { move: 'down' }); load(); }} aria-label="Move down" className="rounded px-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200">↓</button>
                          </span>
                          <button onClick={() => setEditing(p.id)} className="text-slate-400 hover:text-slate-200">Edit</button>
                          <button onClick={async () => { if (confirm(`Remove "${p.title}" from the current version?`)) { await send(`${base}/${p.id}`, 'DELETE'); load(); } }} className="text-rose-400 hover:text-rose-300">Remove</button>
                        </div>
                      )}
                    </div>

                    {/* Discuss, debate, review */}
                    {isCurrent && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 pl-9 text-xs">
                        {(p.thread_id || data.canPost) && (
                          <button onClick={() => discuss(p)} disabled={busy === p.id} className="rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300 hover:border-slate-500">
                            💬 Discuss{p.thread_id ? ` (${p.post_count ?? 0})` : ''}
                          </button>
                        )}
                        {(p.resolution_id || data.canModerate) && (
                          <button onClick={() => debate(p)} disabled={busy === p.id} className="rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300 hover:border-slate-500">
                            ⚖️ {p.resolution_id ? `Debate · ${p.vote_total_for ?? 0} for / ${p.vote_total_against ?? 0} against` : 'Open a debate'}
                          </button>
                        )}
                        {data.canPost && reviewing !== p.id && (
                          <button onClick={() => { setReviewing(p.id); setReviewText(''); }} className="rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300 hover:border-slate-500">Request a review</button>
                        )}
                      </div>
                    )}
                    {reviewing === p.id && (
                      <div className="mt-3 space-y-2 pl-9">
                        <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} rows={2} maxLength={2000} autoFocus
                          placeholder="What should change, and why?" className={inputCls} />
                        <div className="flex gap-2 text-xs">
                          <button onClick={async () => { const err = await send(`${base}/${p.id}/reviews`, 'POST', { text: reviewText }); if (err) setError(err); else { setReviewing(null); load(); } }}
                            disabled={!reviewText.trim()} className="rounded bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-500 disabled:opacity-50">Send request</button>
                          <button onClick={() => setReviewing(null)} className="text-slate-500 hover:text-slate-300">Cancel</button>
                        </div>
                      </div>
                    )}
                    {p.reviews.length > 0 && (
                      <ul className="mt-3 space-y-1.5 pl-9">
                        {p.reviews.map(r => (
                          <li key={r.id} className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs">
                            <span className={`mr-2 font-semibold ${r.status === 'under_review' ? 'text-sky-300' : 'text-amber-300'}`}>{r.status === 'under_review' ? 'Under review' : 'Review requested'}</span>
                            <span className="text-slate-300">{r.text}</span>
                            <span className="text-slate-500"> · @{r.by ?? 'unknown'}, {day(r.created_at)}</span>
                            {data.canModerate && (
                              <span className="ml-2 inline-flex gap-2">
                                {r.status === 'pending' && <button onClick={async () => { await send(`${base}/${p.id}/reviews`, 'PATCH', { reviewId: r.id, status: 'under_review' }); load(); }} className="text-sky-400 hover:underline">Mark under review</button>}
                                <button onClick={async () => { await send(`${base}/${p.id}/reviews`, 'PATCH', { reviewId: r.id, status: 'resolved' }); load(); }} className="text-emerald-400 hover:underline">Resolve</button>
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
