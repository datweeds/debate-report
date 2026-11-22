'use client';

import ReportButton from '@/components/ReportButton';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import RichText from '@/components/discussions/RichText';
import PrincipleForm, { CATEGORY_META, type PrincipleFields } from './PrincipleForm';
import SecureAccessDialog from '@/components/sealed/SecureAccessDialog';
import { useSecureAccess } from '@/components/sealed/useSecureAccess';
import { keysFor, newItemKeys, newSealedThread, openItemText, sealItemText, sealItemTextOrNull, societyMembers, type ItemKeys } from '@/components/sealed/items';
import { societyDebateSealer } from '@/components/chamber/sealedDebate';

type Review = { id: string; text: string; status: 'pending' | 'under_review'; by: string | null; created_at: string };
type Principle = PrincipleFields & {
  id: string; lineage_id: string; sort_order: number; grounding: string;
  thread_id: string | null; resolution_id: string | null; post_count: number | null;
  vote_total_for: number | null; vote_total_against: number | null; reviews: Review[];
};
type Version = { id: string; version: number; change_note: string | null; is_current: boolean; created_at: string; created_by: string | null };
type Everything = { principles: { id: string; title: string; body: string; grounding: string | null; section: string | null }[]; reviews: { id: string; text: string }[] };
type Data = {
  version: Version | null; versions: Version[]; principles: Principle[]; canPost: boolean; canModerate: boolean;
  sealed: { id: string; epoch: number } | null; canSeal: boolean; all: Everything | null;
};
type LibraryItem = PrincipleFields & { id: string; library: string };

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
  const [libraryName, setLibraryName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  // Sealed principles: opened and sealed here, with this person's keys
  const societyBase = `/api/societies/${societyId}`;
  const access = useSecureAccess();
  const [keys, setKeys] = useState<ItemKeys | null>(null);
  const [keyError, setKeyError] = useState(false);
  const [dialog, setDialog] = useState<'setup' | 'unlock' | null>(null);
  const [raw, setRaw] = useState<Data | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`${base}${viewVersion ? `?version=${viewVersion}` : ''}`);
    if (r.ok) setRaw(await r.json()); else setError('Could not load the principles.');
  }, [base, viewVersion]);
  useEffect(() => { load(); }, [load]);

  const sealedId = raw?.sealed?.id ?? null;
  useEffect(() => {
    if (!sealedId || access.status !== 'ready' || !access.identity || keys?.id === sealedId) return;
    keysFor(societyBase, 'principles', sealedId, access.identity).then(setKeys).catch(() => setKeyError(true));
  }, [sealedId, access.status, access.identity, keys?.id, societyBase]);
  // What people read: sealed text opened, or a placeholder without a key
  useEffect(() => {
    if (!raw) return;
    if (!raw.sealed) { setData(raw); return; }
    const o = (v: string | null) => openItemText(keys, v);
    setData({
      ...raw,
      version: raw.version && { ...raw.version, change_note: o(raw.version.change_note) },
      versions: raw.versions.map(v => ({ ...v, change_note: o(v.change_note) })),
      principles: raw.principles.map(p => ({
        ...p, title: o(p.title) ?? 'Sealed principle', body: o(p.body) ?? '', grounding: o(p.grounding) ?? '', section: o(p.section) ?? '',
        reviews: p.reviews.map(r => ({ ...r, text: o(r.text) ?? 'Sealed request' })),
      })),
    });
  }, [raw, keys]);
  const sealedNow = !!sealedId;
  const canWrite = !sealedNow || !!keys?.keys.has(keys.epoch);
  const s1 = (v: string) => (sealedNow && keys && v ? sealItemText(keys, v) : v);
  const sealFields = (p: PrincipleFields) => ({ ...p, title: s1(p.title.trim()), body: s1(p.body.trim()), grounding: s1(p.grounding.trim()), section: s1(p.section.trim()) });

  async function everything(): Promise<Everything> {
    const r = await fetch(`${base}?all=1`);
    if (!r.ok) throw new Error('Couldn’t load the principles');
    return (await r.json()).all;
  }
  async function sealAll() {
    if (!confirm('Seal these principles? Every principle, in every version, with its sections, change notes and review requests, will be encrypted in members’ browsers, so only members can read them, not new.vote. They can be put to a debate only if the Society’s debates are sealed too. Members need secure access to read them.')) return;
    if (access.status !== 'ready') { setDialog(access.status === 'locked' ? 'unlock' : 'setup'); return; }
    setBusy('seal'); setError('');
    try {
      const [all, { members }] = await Promise.all([everything(), societyMembers(societyBase)]);
      const itemId = crypto.randomUUID();
      const { keys: k, locks } = newItemKeys('principles', itemId, members);
      const r = await fetch(`${base}/seal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        action: 'seal', itemId, locks,
        principles: all.principles.map(p => ({ id: p.id, title: sealItemText(k, p.title), body: sealItemText(k, p.body), grounding: sealItemTextOrNull(k, p.grounding), section: sealItemTextOrNull(k, p.section) })),
        versions: (raw?.versions ?? []).map(v => ({ id: v.id, changeNote: sealItemTextOrNull(k, v.change_note) })),
        reviews: all.reviews.map(x => ({ id: x.id, text: sealItemText(k, x.text) })),
      }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Couldn’t seal the principles');
      setKeys(k); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  async function unsealAll() {
    if (!keys || !confirm('Unseal these principles? They go back to being encrypted on the server with the Society’s key, so AI, scanning and Sys Admin emergency access can reach them again.')) return;
    setBusy('seal'); setError('');
    try {
      const all = await everything();
      const o = (v: string | null) => openItemText(keys, v);
      const principles = all.principles.map(p => ({ id: p.id, title: o(p.title), body: o(p.body), grounding: o(p.grounding), section: o(p.section) }));
      const reviews = all.reviews.map(x => ({ id: x.id, text: o(x.text) }));
      if (principles.some(p => p.title == null || p.body == null) || reviews.some(x => x.text == null)) throw new Error('Some principles can’t be opened with your keys, so they can’t be unsealed from here');
      const r = await fetch(`${base}/seal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        action: 'unseal', principles, reviews, versions: (raw?.versions ?? []).map(v => ({ id: v.id, changeNote: o(v.change_note) })),
      }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Couldn’t unseal the principles');
      setKeys(null); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  async function send(url: string, method: string, body?: unknown): Promise<string | null> {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) return (await r.json().catch(() => ({}))).error ?? 'Something went wrong';
    return null;
  }

  async function discuss(p: Principle) {
    setBusy(p.id);
    // Sealed principles: start a sealed discussion here, with the principle's text, then link it
    if (sealedNow && !p.thread_id) {
      if (!access.identity) { setBusy(null); setDialog(access.status === 'locked' ? 'unlock' : 'setup'); return; }
      const { members } = await societyMembers(societyBase);
      const t = newSealedThread(members, `Principle: ${p.title}`.slice(0, 200), `${p.body}${p.grounding ? `\n\nWhy: ${p.grounding}` : ''}\n\nDiscuss this principle here.`);
      const made = await fetch(`${societyBase}/threads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) });
      if (!made.ok) { setBusy(null); setError((await made.json().catch(() => ({}))).error ?? 'Could not start the discussion'); return; }
      const linked = await fetch(`${base}/${p.id}/discuss`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threadId: t.id }) });
      setBusy(null);
      if (!linked.ok) { setError((await linked.json().catch(() => ({}))).error ?? 'Could not link the discussion'); return; }
      router.push(`/society/${societyId}/discussions/${t.id}`); return;
    }
    const r = await fetch(`${base}/${p.id}/discuss`, { method: 'POST' });
    setBusy(null);
    if (!r.ok) { setError((await r.json()).error ?? 'Could not open the discussion'); return; }
    router.push(`/society/${societyId}/discussions/${(await r.json()).threadId}`);
  }

  async function debate(p: Principle) {
    if (!p.resolution_id && !confirm(`Open a debate on "${p.title}"? Members will be able to argue for and against it, and vote.`)) return;
    setBusy(p.id);
    let r = await fetch(`${base}/${p.id}/debate`, { method: 'POST' });
    // The Society's debates are sealed: the new debate's text is sealed here
    if (r.status === 409 && (await r.clone().json().catch(() => ({}))).sealedDebates) {
      try {
        const { seal } = await societyDebateSealer(societyId);
        r = await fetch(`${base}/${p.id}/debate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          title: seal(`This Society should keep the principle: ${p.title}`.slice(0, 500)),
          description: seal(`${p.body}${p.grounding ? `\n\nWhy: ${p.grounding}` : ''}\n\nOne of this Society's principles. Argue for keeping it as it is, or against (and how it should change).`),
        }) });
      } catch (e) { setBusy(null); setError((e as Error).message); return; }
    }
    setBusy(null);
    if (!r.ok) { setError((await r.json()).error ?? 'Could not open the debate'); return; }
    router.push(`/chamber?resolution=${(await r.json()).resolutionId}`);
  }

  async function openLibrary() {
    setPicked(new Set());
    const r = await fetch('/api/principle-library');
    const items: LibraryItem[] = r.ok ? (await r.json()).principles : [];
    setLibrary(items);
    setLibraryName(items[0]?.library ?? '');
  }

  const keysPending = !!sealedId && !keys && !keyError && (access.status === 'loading' || access.status === 'ready');
  if (!data || keysPending) return error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-40 rounded-2xl bg-slate-800/40 animate-pulse" />;

  const isCurrent = !data.version || data.version.is_current;
  const canEdit = data.canModerate && isCurrent && canWrite;
  const shown = data.principles.filter(p => filter === 'all' || p.category === filter);
  // Sections in the order their first principle appears; unsectioned ones last, as "Other"
  const sectionNames = [...new Set(data.principles.map(p => p.section).filter(Boolean))] as string[];
  const groups = [...sectionNames, ''].map(name => ({ name, items: shown.filter(p => (p.section || '') === name) })).filter(g => g.items.length);

  async function renameSection(from: string) {
    const to = prompt(from ? `Rename the section “${from}” to:` : 'Put these principles in a section named:', from);
    if (to === null || to.trim() === from) return;
    // Sealed: the server can't read section names, so say which principles move
    const err = sealedNow
      ? await send(`${base}/sections`, 'PATCH', { ids: data!.principles.filter(p => (p.section || '') === from).map(p => p.id), to: to.trim() ? s1(to.trim()) : '' })
      : await send(`${base}/sections`, 'PATCH', { from, to });
    if (err) setError(err); else load();
  }

  return (
    <div className="space-y-4">
      {dialog && <SecureAccessDialog mode={dialog} onDone={() => setDialog(null)} onClose={() => setDialog(null)} />}
      {sealedNow && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-slate-300">
          <span className="font-semibold text-emerald-300">🔐 Sealed principles:</span> end-to-end encrypted, with their versions and review requests, so only
          members can read them, not new.vote. Debates on them need the Society’s debates sealed too; discussions about them are sealed.
          {access.status === 'none' && <> <button onClick={() => setDialog('setup')} className="font-semibold text-blue-300 hover:underline">Set up secure access</button> to read them.</>}
          {access.status === 'locked' && <> <button onClick={() => setDialog('unlock')} className="font-semibold text-blue-300 hover:underline">Unlock secure access</button> on this device to read them.</>}
          {access.status === 'ready' && keys && !keys.keys.size && <span className="text-amber-200"> Waiting for access: another member’s browser shares the key next time they open the principles.</span>}
          {data.canModerate && keys?.keys.size ? <> <button onClick={unsealAll} disabled={busy === 'seal'} className="text-slate-400 hover:text-slate-200 hover:underline">Unseal</button></> : null}
        </div>
      )}
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="w-full sm:w-auto sm:flex-1 min-w-0 text-sm text-slate-400">The rules, aspirations and guidelines this Society runs by.</p>
        {data.versions.length > 0 && (
          <select value={data.version?.version ?? ''} onChange={e => setViewVersion(Number(e.target.value))} aria-label="Version"
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300">
            {data.versions.map(v => <option key={v.id} value={v.version}>Version {v.version}{v.is_current ? ' (current)' : ''}</option>)}
          </select>
        )}
        {data.canSeal && !sealedNow && isCurrent && (
          <button onClick={sealAll} disabled={busy === 'seal'} title="End-to-end encrypt all the principles" className="rounded-lg border border-emerald-600/50 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50">
            {busy === 'seal' ? 'Sealing…' : '🔐 Seal principles'}
          </button>
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
        <div className={`rounded-xl border px-4 py-2.5 text-xs ${isCurrent ? 'border-slate-800 bg-dr-card text-slate-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
          {!isCurrent && <span className="font-semibold">You&apos;re viewing an earlier version. </span>}
          Version {data.version.version}, {day(data.version.created_at)}{data.version.created_by ? ` by @${data.version.created_by}` : ''}
          {data.version.change_note ? `: ${data.version.change_note}` : ''}
          {!isCurrent && <button onClick={() => setViewVersion(null)} className="ml-2 underline">Show current</button>}
        </div>
      )}

      {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

      {publishing && (
        <div className="rounded-2xl border border-slate-700 bg-dr-card p-4 space-y-3">
          <p className="text-sm text-slate-200">Publish version {(data.version?.version ?? 0) + 1}</p>
          <p className="text-xs text-slate-500">The current principles are copied into the new version, which you can then edit. Version {data.version?.version} stays readable in the history, and discussions and debates carry over.</p>
          <textarea value={changeNote} onChange={e => setChangeNote(e.target.value)} rows={2} maxLength={2000} placeholder="What changes in this version?" className={inputCls} autoFocus />
          <div className="flex gap-2">
            <button onClick={async () => { const err = await send(`${base}/versions`, 'POST', { changeNote: s1(changeNote.trim()) }); if (err) setError(err); else { setPublishing(false); setChangeNote(''); setViewVersion(null); load(); } }}
              disabled={!changeNote.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">Publish</button>
            <button onClick={() => setPublishing(false)} className="px-2 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
          </div>
        </div>
      )}

      {adding && (
        <PrincipleForm saveLabel="Add principle" sections={sectionNames} onCancel={() => setAdding(false)}
          onSave={async p => { const err = await send(base, 'POST', sealFields(p)); if (!err) { setAdding(false); load(); } return err; }} />
      )}

      {library && (
        <div className="rounded-2xl border border-slate-700 bg-dr-card p-4 space-y-3">
          <p className="text-sm text-slate-200">Copy from the general library</p>
          <p className="text-xs text-slate-500">Choose whole sections or single principles. Copies keep their section and become this Society&apos;s own to edit.</p>
          <div className="flex flex-wrap gap-2">
            {[...new Set(library.map(l => l.library))].map(name => (
              <button key={name} type="button" onClick={() => setLibraryName(name)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${libraryName === name ? 'border-blue-500/60 bg-blue-500/15 text-blue-200' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>
                {name} library
              </button>
            ))}
          </div>
          <div className="max-h-[55vh] space-y-4 overflow-y-auto">
            {[...new Set(library.filter(l => l.library === libraryName).map(l => l.section || 'Other'))].map(sec => {
              const items = library.filter(l => l.library === libraryName && (l.section || 'Other') === sec);
              const all = items.every(l => picked.has(l.id));
              return (
                <div key={sec}>
                  <label className="mb-1.5 flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <input type="checkbox" checked={all} className="accent-blue-500"
                      onChange={() => setPicked(s => { const n = new Set(s); items.forEach(l => all ? n.delete(l.id) : n.add(l.id)); return n; })} />
                    {sec} <span className="font-normal normal-case tracking-normal text-slate-600">· whole section ({items.length})</span>
                  </label>
                  <ul className="space-y-2">
                    {items.map(l => (
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
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={async () => {
              // Sealed: each library principle is sealed here and added one by one
              let err: string | null = null;
              if (sealedNow) {
                for (const l of library.filter(x => picked.has(x.id))) {
                  err = await send(base, 'POST', sealFields({ category: l.category, title: l.title, body: l.body, grounding: l.grounding ?? '', section: l.section ?? '' }));
                  if (err) break;
                }
              } else err = await send(`${base}/copy`, 'POST', { libraryIds: [...picked] });
              if (err) setError(err); else { setLibrary(null); load(); } }}
              disabled={!picked.size} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">Copy {picked.size || ''} selected</button>
            <button onClick={() => setPicked(s => new Set([...s, ...library.filter(l => l.library === libraryName).map(l => l.id)]))} className="px-2 text-sm text-slate-400 hover:text-slate-200">Select whole library</button>
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
        <div className="rounded-2xl border border-slate-800 bg-dr-card p-10 text-center text-sm text-slate-500">
          No principles yet.{canEdit ? ' Add your own, or copy a starting set from the library.' : ''}
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(g => (
            <section key={g.name || 'other'}>
              <div className="mb-3 flex items-center gap-3 border-b border-slate-800 pb-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">{g.name || (sectionNames.length ? 'Other' : 'Principles')}</h3>
                <span className="text-xs text-slate-600">{g.items.length}</span>
                {canEdit && (g.name || sectionNames.length > 0) && (
                  <button onClick={() => renameSection(g.name)} className="ml-auto text-xs text-slate-500 hover:text-slate-300">{g.name ? 'Rename section' : 'Put in a section'}</button>
                )}
              </div>
          <ol className="space-y-3">
          {g.items.map(p => {
            const n = data.principles.indexOf(p) + 1;
            return (
              <li key={p.id} className="rounded-2xl border border-slate-800 bg-dr-card p-4">
                {editing === p.id ? (
                  <PrincipleForm initial={{ ...p, section: p.section ?? '' }} sections={sectionNames} onCancel={() => setEditing(null)}
                    onSave={async v => { const err = await send(`${base}/${p.id}`, 'PATCH', sealFields(v)); if (!err) { setEditing(null); load(); } return err; }} />
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
                        <span className="order-last ml-auto">
                          <ReportButton kind="principle" id={p.id} what="this principle" sealed={!!sealedId}
                            shown={() => [p.title, p.body, p.grounding].filter(Boolean).join('\n')} />
                        </span>
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
                        {data.canPost && canWrite && reviewing !== p.id && (
                          <button onClick={() => { setReviewing(p.id); setReviewText(''); }} className="rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300 hover:border-slate-500">Request a review</button>
                        )}
                      </div>
                    )}
                    {reviewing === p.id && (
                      <div className="mt-3 space-y-2 pl-9">
                        <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} rows={2} maxLength={2000} autoFocus
                          placeholder="What should change, and why?" className={inputCls} />
                        <div className="flex gap-2 text-xs">
                          <button onClick={async () => { const err = await send(`${base}/${p.id}/reviews`, 'POST', { text: s1(reviewText.trim()) }); if (err) setError(err); else { setReviewing(null); load(); } }}
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
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
