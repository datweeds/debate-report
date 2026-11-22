'use client';

import { useEffect, useState } from 'react';
import SecureAccessDialog from '@/components/sealed/SecureAccessDialog';
import { useSecureAccess } from '@/components/sealed/useSecureAccess';
import { newItemKeys, societyMembers } from '@/components/sealed/items';
import { openPayload, SEALED_POLL, sealPayloadE2E, useSealedPoll } from './sealedPoll';
import { hasOptions, QUESTION_LABELS, QUESTION_TYPES, type PollPayload, type PollSettings, type Question, type QuestionType } from '@/lib/polls/types';
import { btnGhost, btnPrimary, card, inputCls, newId, resizeImage } from './shared';

type Settings = Omit<PollSettings, 'status' | 'questions_revealed'>;

const DEFAULTS: Settings = {
  close_mode: 'manual', closes_at: null, question_order: 'all_at_once', result_visibility: 'after_close',
  ballot_mode: 'secret', allow_revote: true, is_quiz: false, allow_codes: false, members_may_vote: true,
  formal: false, quorum_pct: null, majority: 'simple',
};

const newQuestion = (type: QuestionType = 'single_choice'): Question => ({
  id: newId(), text: '', type,
  options: hasOptions(type) ? [{ id: newId(), text: '' }, { id: newId(), text: '' }] : [],
  settings: type === 'scale' ? { scaleMin: 1, scaleMax: 10 } : {},
});

// Create or edit a poll (questions can change only while it's a draft).
export default function PollEditor({ societyId, pollId }: { societyId: number; pollId?: string }) {
  const [payload, setPayload] = useState<PollPayload>({ title: '', questions: [newQuestion()] });
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [status, setStatus] = useState<'draft' | 'open' | 'closed'>('draft');
  const [loaded, setLoaded] = useState(!pollId);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Sealed: chosen when creating; a sealed draft's questions are opened and sealed here
  const access = useSecureAccess();
  const [allowSealed, setAllowSealed] = useState(false);
  const [sealIt, setSealIt] = useState(false);
  const [sealedPayload, setSealedPayload] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'setup' | 'unlock' | null>(null);
  const sp = useSealedPoll(societyId, pollId ?? null, !!sealedPayload);
  useEffect(() => { if (!pollId) societyMembers(`/api/societies/${societyId}`).then(m => setAllowSealed(m.allowSealed)); }, [societyId, pollId]);

  useEffect(() => {
    if (!pollId) return;
    fetch(`/api/societies/${societyId}/polls/${pollId}`).then(async r => {
      if (!r.ok) { setError('Could not load the poll.'); return; }
      const { poll } = await r.json();
      if (poll.protection === 'sealed') setSealedPayload(poll.sealed_payload); else { setPayload(poll.payload); setLoaded(true); }
      setStatus(poll.status);
      setSettings(Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, poll[k]])) as Settings);
    });
  }, [societyId, pollId]);
  useEffect(() => {
    if (!sealedPayload || !sp.keys) return;
    const p = openPayload(sp.keys, sealedPayload);
    if (p) { setPayload(p); setLoaded(true); } else setError('This sealed poll can’t be opened with your keys.');
  }, [sealedPayload, sp.keys]);
  const sealed = !!sealedPayload || sealIt;

  const draft = status === 'draft';
  const setQ = (i: number, q: Partial<Question>) => setPayload(p => ({ ...p, questions: p.questions.map((x, j) => j === i ? { ...x, ...q } : x) }));
  const setS = (patch: Partial<Settings>) => setSettings(s => ({ ...s, ...patch }));

  async function save() {
    setSaving(true); setError('');
    let body: Record<string, unknown> = { ...settings, ...(draft ? { payload } : {}), closes_at: settings.close_mode === 'fixed' ? settings.closes_at : null };
    if (sealIt && !pollId) {
      // A new sealed poll: its own key, for every member with secure access
      if (access.status !== 'ready') { setSaving(false); setDialog(access.status === 'locked' ? 'unlock' : 'setup'); return; }
      const { members } = await societyMembers(`/api/societies/${societyId}`);
      const id = crypto.randomUUID();
      const { keys, locks } = newItemKeys('poll', id, members);
      body = { ...body, protection: 'sealed', id, locks, payload: sealPayloadE2E(keys, payload), questionCount: payload.questions.length, is_quiz: false, allow_codes: false };
    } else if (sealedPayload && draft) {
      if (!sp.keys?.keys.has(sp.keys.epoch)) { setSaving(false); setError('You don’t have this sealed poll’s key yet.'); return; }
      body = { ...body, payload: sealPayloadE2E(sp.keys, payload), questionCount: payload.questions.length, is_quiz: false, allow_codes: false };
    }
    const r = await fetch(pollId ? `/api/societies/${societyId}/polls/${pollId}` : `/api/societies/${societyId}/polls`, {
      method: pollId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setSaving(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? 'Could not save.'); return; }
    window.location.href = `/society/${societyId}/polls/${pollId ?? d.id}`;
  }

  if (!loaded) return error ? <p className="text-sm text-rose-300">{error}</p> : <div className="h-40 rounded-2xl bg-slate-800/40 animate-pulse" />;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-lg font-semibold text-slate-100">{pollId ? 'Edit poll' : 'New poll'}</h1>
      {dialog && <SecureAccessDialog mode={dialog} onDone={() => setDialog(null)} onClose={() => setDialog(null)} />}
      {!pollId && allowSealed && (
        <label className="flex items-start gap-2.5 rounded-xl border border-slate-800 p-3 text-xs">
          <input type="checkbox" checked={sealIt} onChange={e => { setSealIt(e.target.checked); if (e.target.checked) setS({ is_quiz: false, allow_codes: false }); }} className="mt-0.5 accent-emerald-500" />
          <span className="text-slate-300"><span className="font-semibold text-slate-100">🔐 Seal this poll</span>: {SEALED_POLL}
            {sealIt && access.status === 'none' && <> <button type="button" onClick={() => setDialog('setup')} className="font-semibold text-blue-300 hover:underline">Set up secure access</button> first.</>}
            {sealIt && access.status === 'locked' && <> <button type="button" onClick={() => setDialog('unlock')} className="font-semibold text-blue-300 hover:underline">Unlock secure access</button> first.</>}
          </span>
        </label>
      )}
      {sealedPayload && <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-slate-300"><span className="text-emerald-300">🔐 </span>{SEALED_POLL}</p>}
      {!draft && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">Voting has started, so only the closing time and who sees results can change.</p>}

      <fieldset disabled={!draft} className={`${card} space-y-3 disabled:opacity-60`}>
        <input value={payload.title} onChange={e => setPayload(p => ({ ...p, title: e.target.value.slice(0, 200) }))} placeholder="Poll title" className={`${inputCls} text-base font-medium`} />
        <textarea value={payload.description ?? ''} onChange={e => setPayload(p => ({ ...p, description: e.target.value.slice(0, 3000) }))} rows={2} placeholder="Description (optional)" className={inputCls} />
        <ImagePicker label="Header image" value={payload.headerImage} onChange={v => setPayload(p => ({ ...p, headerImage: v }))} />
      </fieldset>

      {payload.questions.map((q, i) => (
        <fieldset key={q.id} disabled={!draft} className={`${card} space-y-3 disabled:opacity-60`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Question {i + 1}</p>
            <div className="flex items-center gap-2 text-xs">
              <button type="button" disabled={i === 0} onClick={() => setPayload(p => { const qs = [...p.questions]; [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]]; return { ...p, questions: qs }; })} className="text-slate-400 hover:text-white disabled:opacity-30">↑</button>
              <button type="button" disabled={i === payload.questions.length - 1} onClick={() => setPayload(p => { const qs = [...p.questions]; [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]]; return { ...p, questions: qs }; })} className="text-slate-400 hover:text-white disabled:opacity-30">↓</button>
              {payload.questions.length > 1 && <button type="button" onClick={() => setPayload(p => ({ ...p, questions: p.questions.filter((_, j) => j !== i) }))} className="text-rose-300 hover:underline">Remove</button>}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_14rem]">
            <input value={q.text} onChange={e => setQ(i, { text: e.target.value.slice(0, 500) })} placeholder="Question" className={inputCls} />
            <select value={q.type} className={inputCls} onChange={e => {
              const t = e.target.value as QuestionType;
              setQ(i, { type: t, correct: undefined, options: hasOptions(t) ? (q.options.length >= 2 ? q.options : newQuestion(t).options) : [],
                settings: { ...q.settings, ...(t === 'scale' ? { scaleMin: q.settings.scaleMin ?? 1, scaleMax: q.settings.scaleMax ?? 10 } : {}) } });
            }}>
              {QUESTION_TYPES.map(t => <option key={t} value={t}>{QUESTION_LABELS[t]}</option>)}
            </select>
          </div>

          {hasOptions(q.type) && (
            <div className="space-y-2">
              {q.options.map((o, k) => (
                <div key={o.id} className="flex flex-wrap items-center gap-2">
                  {settings.is_quiz && (
                    <input type={q.type === 'multi_choice' ? 'checkbox' : 'radio'} name={`correct-${q.id}`} title="Correct answer"
                      checked={q.correct?.includes(o.id) ?? false}
                      onChange={e => setQ(i, { correct: q.type === 'multi_choice'
                        ? (e.target.checked ? [...(q.correct ?? []), o.id] : (q.correct ?? []).filter(x => x !== o.id))
                        : [o.id] })} />
                  )}
                  <input value={o.text} onChange={e => setQ(i, { options: q.options.map(x => x.id === o.id ? { ...x, text: e.target.value.slice(0, 300) } : x) })}
                    placeholder={`Option ${k + 1}`} className={`${inputCls} min-w-0 flex-1`} />
                  <input value={o.moreInfoLink ?? ''} onChange={e => setQ(i, { options: q.options.map(x => x.id === o.id ? { ...x, moreInfoLink: e.target.value.trim() || undefined } : x) })}
                    placeholder="More-info link (optional)" className={`${inputCls} w-48 text-xs`} />
                  <ImagePicker compact value={o.image} onChange={v => setQ(i, { options: q.options.map(x => x.id === o.id ? { ...x, image: v } : x) })} />
                  {q.options.length > 2 && <button type="button" onClick={() => setQ(i, { options: q.options.filter(x => x.id !== o.id), correct: q.correct?.filter(x => x !== o.id) })} className="text-xs text-slate-500 hover:text-rose-300">✕</button>}
                </div>
              ))}
              {q.options.length < 30 && <button type="button" onClick={() => setQ(i, { options: [...q.options, { id: newId(), text: '' }] })} className="text-xs text-blue-400 hover:underline">+ Add option</button>}
            </div>
          )}
          {q.type === 'yes_no' && settings.is_quiz && (
            <label className="flex items-center gap-2 text-xs text-slate-300">Correct answer
              <select value={q.correct?.[0] ?? ''} onChange={e => setQ(i, { correct: e.target.value ? [e.target.value] : undefined })} className={`${inputCls} w-28`}>
                <option value="">—</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
            </label>
          )}
          {q.type === 'scale' && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <input type="number" value={q.settings.scaleMin ?? 1} onChange={e => setQ(i, { settings: { ...q.settings, scaleMin: Math.round(Number(e.target.value)) } })} className={inputCls} aria-label="Lowest" />
              <input type="number" value={q.settings.scaleMax ?? 10} onChange={e => setQ(i, { settings: { ...q.settings, scaleMax: Math.round(Number(e.target.value)) } })} className={inputCls} aria-label="Highest" />
              <input value={q.settings.scaleMinLabel ?? ''} onChange={e => setQ(i, { settings: { ...q.settings, scaleMinLabel: e.target.value.slice(0, 40) } })} placeholder="Low label" className={inputCls} />
              <input value={q.settings.scaleMaxLabel ?? ''} onChange={e => setQ(i, { settings: { ...q.settings, scaleMaxLabel: e.target.value.slice(0, 40) } })} placeholder="High label" className={inputCls} />
            </div>
          )}

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300">
            {hasOptions(q.type) && q.type !== 'ranked' && (
              <Check label="Shuffle options for each voter" on={!!q.settings.randomOrder} set={v => setQ(i, { settings: { ...q.settings, randomOrder: v } })} />
            )}
            {q.type === 'multi_choice' && (
              <label className="flex items-center gap-1.5">At most
                <input type="number" min={0} value={q.settings.maxChoices ?? 0} onChange={e => setQ(i, { settings: { ...q.settings, maxChoices: Math.max(0, Math.round(Number(e.target.value))) } })} className={`${inputCls} w-16 py-1`} />
                choices (0 = any)</label>
            )}
            <Check label="Allow comments" on={!!q.settings.allowComments} set={v => setQ(i, { settings: { ...q.settings, allowComments: v } })} />
            {q.settings.allowComments && <Check label="Show comments with the results" on={!!q.settings.commentsPublic} set={v => setQ(i, { settings: { ...q.settings, commentsPublic: v } })} />}
          </div>
        </fieldset>
      ))}
      {draft && payload.questions.length < 50 && (
        <button type="button" onClick={() => setPayload(p => ({ ...p, questions: [...p.questions, newQuestion()] }))} className={btnGhost}>+ Add question</button>
      )}

      <div className={`${card} space-y-4`}>
        <p className="text-sm font-semibold text-slate-200">Settings</p>
        <fieldset disabled={!draft} className="grid gap-4 disabled:opacity-60 sm:grid-cols-2">
          <Choice label="Ballot" value={settings.ballot_mode} set={v => setS({ ballot_mode: v as Settings['ballot_mode'] })} options={[
            ['secret', 'Secret: no one can see who chose what'], ['named', 'Named: Society Admins see who chose what']]} />
          <Choice label="Questions" value={settings.question_order} set={v => setS({ question_order: v as Settings['question_order'], ...(v === 'sequential' ? { allow_revote: true } : {}) })} options={[
            ['all_at_once', 'All at once'], ['sequential', 'One at a time, opened by a Society Admin (live meetings)']]} />
          <div className="space-y-2 text-xs text-slate-300">
            <Check label="Members can change their vote until it closes" on={settings.allow_revote} disabled={settings.question_order === 'sequential'} set={v => setS({ allow_revote: v })} />
            {!sealed && !settings.formal && <Check label="Quiz: mark correct answers and score ballots" on={settings.is_quiz} set={v => setS({ is_quiz: v })} />}
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <Check label="Members vote (signed in)" on={settings.members_may_vote} set={v => setS({ members_may_vote: v })} />
            {!sealed && <Check label="People without an account vote with one-use access codes" on={settings.allow_codes} set={v => setS({ allow_codes: v })} />}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Choice label="Who sees results" value={settings.result_visibility} set={v => setS({ result_visibility: v as Settings['result_visibility'] })} options={[
            ['live', 'Voters, as votes come in'], ['after_close', 'Voters, once it closes'], ['never', 'Only Society Admins']]} />
          <div className="space-y-2">
            <Choice label="Closing" value={settings.close_mode} set={v => setS({ close_mode: v as Settings['close_mode'] })} options={[
              ['manual', 'A Society Admin closes it'], ['fixed', 'At a set time']]} />
            {settings.close_mode === 'fixed' && (
              <input type="datetime-local" className={inputCls}
                value={settings.closes_at ? toLocal(settings.closes_at) : ''}
                onChange={e => setS({ closes_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            )}
          </div>
        </div>
        {!sealed && (
          <fieldset disabled={!draft} className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 disabled:opacity-60">
            <Check label="Formal ballot: for AGMs, elections and constitutional votes" on={settings.formal} set={v => setS({ formal: v, ...(v ? { is_quiz: false } : {}) })} />
            <p className="text-xs text-slate-400">
              The voter roll is fixed when voting opens: the members at that moment, and any access codes made by then. You can appoint scrutineers,
              and once it closes you certify the result: it’s written up, hashed and independently timestamped, so anyone can later check it hasn’t changed.
            </p>
            {settings.formal && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-slate-400">Quorum: share of the roll that must vote (optional)
                  <span className="mt-1 flex items-center gap-2">
                    <input type="number" min={1} max={100} value={settings.quorum_pct ?? ''} aria-label="Quorum percentage"
                      onChange={e => setS({ quorum_pct: e.target.value ? Math.max(1, Math.min(100, Math.round(Number(e.target.value)))) : null })} className={`${inputCls} w-24`} />%
                  </span>
                </label>
                <Choice label="Motions (Yes / No questions) pass with" value={settings.majority} set={v => setS({ majority: v as Settings['majority'] })} options={[
                  ['simple', 'More than half of votes cast'], ['two_thirds', 'At least two-thirds'], ['three_quarters', 'At least three-quarters']]} />
              </div>
            )}
          </fieldset>
        )}
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      <div className="flex gap-2">
        <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? 'Saving…' : pollId ? 'Save' : 'Save draft'}</button>
        <a href={pollId ? `/society/${societyId}/polls/${pollId}` : `/society/${societyId}/polls`} className={btnGhost}>Cancel</a>
      </div>
      <p className="text-xs text-slate-500">Polls are saved as drafts. Open one from its page when it’s ready; questions can’t change once voting starts.</p>
    </div>
  );
}

const toLocal = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

function Check({ label, on, set, disabled }: { label: string; on: boolean; set: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-2 ${disabled ? 'opacity-60' : ''}`}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={e => set(e.target.checked)} className="h-4 w-4 accent-blue-500" />{label}
    </label>
  );
}

function Choice({ label, value, set, options }: { label: string; value: string; set: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-slate-400">{label}</p>
      <div className="space-y-1.5">
        {options.map(([v, text]) => (
          <label key={v} className="flex items-center gap-2 text-xs text-slate-300">
            <input type="radio" checked={value === v} onChange={() => set(v)} className="accent-blue-500" />{text}
          </label>
        ))}
      </div>
    </div>
  );
}

function ImagePicker({ label, value, onChange, compact }: { label?: string; value?: string; onChange: (v: string | undefined) => void; compact?: boolean }) {
  const [err, setErr] = useState('');
  return (
    <div className="flex items-center gap-2 text-xs">
      {value && <img src={value} alt="" className={`${compact ? 'h-8 w-8' : 'h-16 w-28'} rounded object-cover`} />}
      <label className="cursor-pointer text-blue-400 hover:underline">
        {value ? 'Change' : compact ? 'Image' : `Add ${label?.toLowerCase() ?? 'image'}`}
        <input type="file" accept="image/*" className="hidden" onChange={async e => {
          const f = e.target.files?.[0]; if (!f) return;
          try { setErr(''); onChange(await resizeImage(f, compact ? 400 : 1200)); } catch { setErr('Not an image'); }
        }} />
      </label>
      {value && <button type="button" onClick={() => onChange(undefined)} className="text-slate-500 hover:text-rose-300">Remove</button>}
      {err && <span className="text-rose-300">{err}</span>}
    </div>
  );
}
