'use client';

import ReportButton from '@/components/ReportButton';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { PollResults } from '@/lib/polls/server';
import type { Answer, PollPayload, PollSettings } from '@/lib/polls/types';
import Results from './Results';
import VoteSection from './VoteSection';
import { Badge, btnGhost, btnPrimary, card, fmtWhen, inputCls, POLL_STATUS } from './shared';
import SecureAccessDialog from '@/components/sealed/SecureAccessDialog';
import { countSealed, openBallot, openPayload, sealAnswers, SEALED_POLL, useSealedPoll } from './sealedPoll';

type Poll = PollSettings & {
  id: string; payload: PollPayload; open_questions: number; vote_count: number; opened_at: string | null; closed_at: string | null;
  protection: 'server' | 'sealed'; sealed_payload: string | null; question_count: number;
};
type Outcome = {
  turnout: { voted: number; roll: number; pct: number | null }; quorum: { required: number | null; met: boolean | null }; decided: boolean;
  questions: { questionId: string; text: string; outcome: string; detail: string }[];
};
type Formal = {
  quorum_pct: number | null; majority: string; roll: { total: number; members: number; codes: number } | null; outcome: Outcome | null;
  certified: { digest: string; certified_at: string; tsa_time: string | null; has_timestamp: boolean } | null;
  scrutineers: { id: string; handle: string }[] | null;
};
type Data = { scrutineer: boolean; formal: Formal | null; poll: Poll; voted: boolean; myBallot: Answer[] | null; canVote: boolean; isMember: boolean; manager: boolean; members: number | null; voters: { members: number; codes: number } | null; results: (PollResults & { unreadable?: number; invalid?: number }) | null };

// One poll: vote, see results, and (moderators) run it.
export default function PollView({ societyId, pollId, me }: { societyId: number; pollId: string; me: string | null }) {
  const base = `/api/societies/${societyId}/polls/${pollId}`;
  const [raw, setRaw] = useState<Data | null>(null);
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<'setup' | 'unlock' | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(base, { cache: 'no-store' });
    if (r.ok) setRaw(await r.json()); else setError(r.status === 404 ? 'Poll not found.' : 'Could not load the poll.');
  }, [base]);
  useEffect(() => { void load(); }, [load]);
  // A sealed poll: questions, my ballot and the results are opened (and counted) here
  const sealed = raw?.poll.protection === 'sealed';
  const sp = useSealedPoll(societyId, pollId, sealed);
  useEffect(() => {
    if (!raw) return;
    if (!sealed) { setD(raw); return; }
    const payload = openPayload(sp.keys, raw.poll.sealed_payload) ?? { title: 'Sealed poll', questions: [] };
    const mine = typeof raw.myBallot === 'string' ? openBallot(sp.keys, raw.myBallot) : raw.myBallot;
    setD({
      ...raw, poll: { ...raw.poll, payload }, myBallot: mine,
      results: raw.results?.sealedBallots ? countSealed(sp.keys, payload, raw.results.sealedBallots, raw.manager) : raw.results,
    });
  }, [raw, sealed, sp.keys]);
  // Live results refresh while open
  useEffect(() => {
    if (d?.poll.status !== 'open' || !d.results) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [d?.poll.status, d?.results, load]);

  if (error) return <p className="text-sm text-rose-300">{error}</p>;
  if (!d || sp.status === 'pending') return <div className="h-40 rounded-2xl bg-slate-800/40 animate-pulse" />;
  const { poll } = d;
  const st = POLL_STATUS[poll.status];
  const qCount = sealed ? poll.question_count : poll.payload.questions.length;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-5">
        <div>
          <Link href={`/society/${societyId}/polls`} className="text-xs text-slate-500 hover:text-slate-300">← Polls</Link>
          {dialog && <SecureAccessDialog mode={dialog} onDone={() => setDialog(null)} onClose={() => setDialog(null)} />}
          {sealed && (
            <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-slate-300">
              <span className="font-semibold text-emerald-300">🔐 </span>{SEALED_POLL}
              {sp.status === 'none' && <> <button onClick={() => setDialog('setup')} className="font-semibold text-blue-300 hover:underline">Set up secure access</button> to read and vote.</>}
              {sp.status === 'locked' && <> <button onClick={() => setDialog('unlock')} className="font-semibold text-blue-300 hover:underline">Unlock secure access</button> on this device to read and vote.</>}
              {sp.status === 'ready' && !sp.keys?.keys.size && <span className="text-amber-200"> Waiting for access: another member’s browser shares the key next time they open this poll.</span>}
              {(d.results?.unreadable || d.results?.invalid) ? <span className="text-amber-200"> {d.results.unreadable ?? 0} ballot(s) couldn’t be opened and {d.results.invalid ?? 0} didn’t fit the questions; they aren’t counted.</span> : null}
            </div>
          )}
          {poll.payload.headerImage && <img src={poll.payload.headerImage} alt="" className="mt-3 max-h-56 w-full rounded-xl object-cover" />}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-100">{poll.payload.title}</h1>
            <Badge cls={st.cls}>{st.label}</Badge>
            <span className="flex-1" />
            <ReportButton kind="poll" id={pollId} what="this poll" sealed={sealed}
              shown={() => [poll.payload.title, ...poll.payload.questions.map(q => q.text)].filter(Boolean).join('\n')} />
          </div>
          {poll.payload.description && <p className="mt-2 whitespace-pre-line text-sm text-slate-400">{poll.payload.description}</p>}
          <p className="mt-2 text-xs text-slate-500">
            {poll.ballot_mode === 'secret' ? '🔒 Secret ballot: no one can see who chose what.' : '👤 Named ballot: Society Admins can see who chose what.'}
            {poll.status === 'open' && poll.closes_at && ` Closes ${fmtWhen(poll.closes_at)}.`}
            {poll.status === 'closed' && poll.closed_at && ` Closed ${fmtWhen(poll.closed_at)}.`}
            {poll.is_quiz && ' Quiz.'}
          </p>
          {d.formal && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-slate-300">
              <span className="font-semibold text-amber-200">📜 Formal ballot. </span>
              {d.formal.roll ? `The voter roll was fixed when voting opened: ${d.formal.roll.total} voter${d.formal.roll.total === 1 ? '' : 's'}. ` : 'The voter roll is fixed when voting opens. '}
              {d.formal.quorum_pct ? `Quorum: ${d.formal.quorum_pct}% of the roll. ` : ''}Motions need {d.formal.majority} of votes cast.
              {d.formal.certified && <> <Link href={`/society/${societyId}/polls/${pollId}/certificate`} className="font-semibold text-blue-300 hover:underline">Certified result ↗</Link></>}
              {d.scrutineer && <span className="ml-1 text-amber-200">You’re a scrutineer of this ballot.</span>}
            </div>
          )}
        </div>

        {poll.status === 'open' && (
          <div className={card}>
            {!d.isMember && !d.manager ? (
              <p className="text-sm text-slate-400">{me ? 'Join this Society to vote.' : 'Log in and join this Society to vote.'}</p>
            ) : !poll.members_may_vote ? (
              <p className="text-sm text-slate-400">This poll is for access-code holders.</p>
            ) : (
              <VoteSection pollId={poll.id} payload={poll.payload} open={poll.open_questions} voted={d.voted} myBallot={d.myBallot}
                canVote={d.canVote || (d.voted && poll.allow_revote && poll.status === 'open')} allowRevote={poll.allow_revote}
                seed={`${me}:${poll.id}`} castUrl={`${base}/vote`} auditHref={`/society/${societyId}/polls/${pollId}/audit`} onVoted={load}
                seal={sealed ? (sp.canWrite && sp.keys ? (a => sealAnswers(sp.keys!, a)) : null) : undefined} />
            )}
            {poll.question_order === 'sequential' && poll.open_questions < qCount && (
              <p className="mt-3 text-xs text-slate-500">{poll.open_questions} of {qCount} questions are open. More will open during the meeting.</p>
            )}
          </div>
        )}
        {poll.status === 'closed' && d.voted && <p className="text-sm text-emerald-300">✓ You voted in this poll.</p>}

        {d.formal?.outcome && <OutcomeCard o={d.formal.outcome} />}
        {d.results ? (
          <div className={card}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-200">{poll.status === 'closed' ? 'Results' : 'Results so far'}</p>
              {poll.result_visibility !== 'live' && poll.status !== 'closed' && d.manager && <span className="text-[11px] text-slate-500">Only Society Admins see these until it closes</span>}
            </div>
            <Results results={d.results} payload={poll.payload} />
          </div>
        ) : poll.status !== 'draft' && (
          <p className="text-sm text-slate-500">{poll.result_visibility === 'never' ? 'Results are seen only by the Society Admins.' : 'Results will be shown when the poll closes.'}</p>
        )}
      </div>

      {d.manager ? <ManagerPanel societyId={societyId} pollId={pollId} base={base} d={d} reload={load} />
        : d.scrutineer && poll.status !== 'draft' && (
          <aside className="space-y-4">
            <div className={`${card} space-y-2 text-xs`}>
              <p className="text-sm font-semibold text-slate-200">Scrutineer</p>
              <p className="text-slate-400">You can check the count and see who has voted (never how), but you can’t change anything.</p>
              <div className="flex flex-wrap gap-x-4">
                <Link href={`/society/${societyId}/polls/${pollId}/audit`} className="text-blue-400 hover:underline">Audit log</Link>
                {d.formal?.certified && <Link href={`/society/${societyId}/polls/${pollId}/certificate`} className="text-blue-400 hover:underline">Certified result</Link>}
              </div>
            </div>
            <Verify base={base} />
            <Turnout base={base} />
          </aside>
        )}
    </div>
  );
}

function ManagerPanel({ societyId, pollId, base, d, reload }: { societyId: number; pollId: string; base: string; d: Data; reload: () => void }) {
  const { poll } = d;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function act(action: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setError('');
    const r = await fetch(base, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    setBusy(false);
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? 'That didn’t work.'); return; }
    reload();
  }
  async function remove() {
    if (!window.confirm('Delete this poll and its ballots?')) return;
    const r = await fetch(base, { method: 'DELETE' });
    if (r.ok) window.location.href = `/society/${societyId}/polls`;
  }

  // Turnout counts members only; access-code voters are shown separately
  const turnout = d.members ? Math.min(100, Math.round(((d.voters?.members ?? poll.vote_count) / d.members) * 100)) : null;
  return (
    <aside className="space-y-4">
      <div className={`${card} space-y-3`}>
        <p className="text-sm font-semibold text-slate-200">Run this poll</p>
        {poll.status !== 'draft' && (
          <div>
            <p className="text-2xl font-semibold tabular-nums text-slate-100">{poll.vote_count}<span className="ml-1 text-sm font-normal text-slate-500">voted{turnout !== null && poll.members_may_vote ? ` · ${turnout}% of ${d.members} members` : ''}{d.voters?.codes && poll.members_may_vote ? ` · ${d.voters.codes} by code` : ''}</span></p>
            {turnout !== null && poll.members_may_vote && <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, turnout)}%` }} /></div>}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {poll.status === 'draft' && <button className={btnPrimary} disabled={busy} onClick={() => act('open', 'Open this poll for voting? Its questions can’t be changed after this.')}>Open for voting</button>}
          {poll.status === 'open' && poll.question_order === 'sequential' && poll.open_questions < (poll.protection === 'sealed' ? poll.question_count : poll.payload.questions.length) &&
            <button className={btnPrimary} disabled={busy} onClick={() => act('reveal')}>Open question {poll.open_questions + 1}</button>}
          {poll.status === 'open' && <button className={btnGhost} disabled={busy} onClick={() => act('close', 'Close this poll now?')}>Close poll</button>}
          {poll.status === 'closed' && !d.formal?.certified && <button className={btnGhost} disabled={busy} onClick={() => act('reopen', 'Reopen this poll for voting?')}>Reopen</button>}
          {poll.status === 'closed' && d.formal && !d.formal.certified && (
            <button className={btnPrimary} disabled={busy} onClick={() => act('certify', 'Certify this result? The count is checked, then the result is written up, hashed and independently timestamped. The ballot can’t be reopened afterwards.')}>
              {busy ? 'Certifying…' : 'Certify result'}
            </button>
          )}
          <Link href={`/society/${societyId}/polls/${pollId}/edit`} className={btnGhost}>{poll.status === 'draft' ? 'Edit' : 'Settings'}</Link>
        </div>
        {poll.status !== 'draft' && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link href={`/society/${societyId}/polls/${pollId}/present`} className="text-blue-400 hover:underline">Present live ↗</Link>
            {poll.protection !== 'sealed' && <a href={`${base}/results?format=csv`} className="text-blue-400 hover:underline">Download CSV</a>}
            <Link href={`/society/${societyId}/polls/${pollId}/audit`} className="text-blue-400 hover:underline">Audit log</Link>
          </div>
        )}
        {error && <p className="text-xs text-rose-300">{error}</p>}
      </div>

      {poll.status !== 'draft' && <Verify base={base} browserChecks={poll.protection === 'sealed' ? d.results : undefined} />}
      {poll.status !== 'draft' && <Turnout base={base} />}
      {d.formal && <Scrutineers base={base} initial={d.formal.scrutineers ?? []} locked={!!d.formal.certified} />}
      {poll.allow_codes && poll.status !== 'closed' && !(d.formal && poll.status !== 'draft') && <Codes base={base} pollId={pollId} draft={poll.status === 'draft'} />}
      <button onClick={remove} className="text-xs text-rose-300 hover:underline">Delete poll</button>
    </aside>
  );
}

function Verify({ base, browserChecks }: { base: string; browserChecks?: (PollResults & { unreadable?: number; invalid?: number }) | null }) {
  const [res, setRes] = useState<{ ok: boolean; checks: { label: string; ok: boolean; detail: string }[]; replacedBallots: number } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className={`${card} space-y-2`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-200">Check the count</p>
        <button className={btnGhost} disabled={busy} onClick={async () => {
          setBusy(true); const r = await fetch(`${base}/verify`, { cache: 'no-store' }); setBusy(false);
          if (!r.ok) return;
          const v = await r.json();
          // A sealed poll: the ballots were opened, checked and counted in this browser
          if (browserChecks) {
            const extra = [
              { label: 'Every ballot opens (in your browser)', ok: !browserChecks.unreadable, detail: String(browserChecks.unreadable ?? 0) },
              { label: 'Every ballot is valid for its questions', ok: !browserChecks.invalid, detail: String(browserChecks.invalid ?? 0) },
            ];
            v.checks = [...v.checks, ...extra]; v.ok = v.ok && extra.every(x => x.ok);
          }
          setRes(v);
        }}>{busy ? 'Checking…' : res ? 'Check again' : 'Verify'}</button>
      </div>
      {!res && <p className="text-xs text-slate-500">Recounts every ballot from scratch and checks voters, ballots and receipts all agree.</p>}
      {res && (
        <>
          <p className={`text-sm font-medium ${res.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{res.ok ? '✓ The count is consistent' : '✕ Something doesn’t add up'}</p>
          <ul className="space-y-1 text-xs">
            {res.checks.map(c => (
              <li key={c.label} className="flex justify-between gap-2"><span className={c.ok ? 'text-slate-300' : 'text-rose-300'}>{c.ok ? '✓' : '✕'} {c.label}</span><span className="tabular-nums text-slate-500">{c.detail}</span></li>
            ))}
          </ul>
          {res.replacedBallots > 0 && <p className="text-[11px] text-slate-500">{res.replacedBallots} earlier ballot{res.replacedBallots > 1 ? 's were' : ' was'} replaced by voters changing their vote (kept, not counted).</p>}
        </>
      )}
    </div>
  );
}

function Turnout({ base }: { base: string }) {
  const [t, setT] = useState<{ voted: { voted_at: string; handle: string | null; name: string | null; code_label: string | null }[]; notYet: { handle: string; name: string | null }[] } | null>(null);
  return (
    <details className={card} onToggle={async e => {
      if ((e.target as HTMLDetailsElement).open && !t) { const r = await fetch(`${base}/participants`); if (r.ok) setT(await r.json()); }
    }}>
      <summary className="cursor-pointer text-sm font-semibold text-slate-200">Who has voted</summary>
      <p className="mt-1 text-[11px] text-slate-500">Who took part, never how they voted.</p>
      {!t ? <p className="mt-2 text-xs text-slate-500">Loading…</p> : (
        <div className="mt-2 space-y-3 text-xs">
          <ul className="space-y-0.5 text-slate-300">
            {t.voted.length === 0 && <li className="text-slate-500">No one yet.</li>}
            {t.voted.map((v, i) => <li key={i} className="flex justify-between gap-2"><span>{v.handle ? `@${v.handle}` : `🔑 ${v.code_label || 'Access code'}`}</span><span className="text-slate-500">{fmtWhen(v.voted_at)}</span></li>)}
          </ul>
          {t.notYet.length > 0 && (
            <div>
              <p className="text-slate-500">Not voted yet ({t.notYet.length})</p>
              <p className="mt-0.5 text-slate-400">{t.notYet.map(m => `@${m.handle}`).join(', ')}</p>
            </div>
          )}
        </div>
      )}
    </details>
  );
}

function Codes({ base, pollId, draft }: { base: string; pollId: string; draft: boolean }) {
  const [codes, setCodes] = useState<{ id: string; label: string | null; created_at: string; used_at: string | null; revoked_at: string | null }[] | null>(null);
  const [labels, setLabels] = useState('');
  const [made, setMade] = useState<{ code: string; label: string | null }[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => { const r = await fetch(`${base}/codes`); if (r.ok) setCodes((await r.json()).codes); }, [base]);
  useEffect(() => { void load(); }, [load]);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/poll/${pollId}` : `/poll/${pollId}`;
  const [copied, setCopied] = useState<'link' | 'codes' | null>(null);
  async function copy(what: 'link' | 'codes', value: string) {
    try { await navigator.clipboard.writeText(value); } catch { return; }
    setCopied(what);
    setTimeout(() => setCopied(c => (c === what ? null : c)), 2000);
  }

  async function make() {
    setError('');
    const lines = labels.split('\n').map(l => l.trim()).filter(Boolean);
    const body = /^\d+$/.test(labels.trim()) ? { count: Number(labels.trim()) } : { labels: lines };
    const r = await fetch(`${base}/codes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? 'Could not make codes.'); return; }
    setMade(d.codes); setLabels(''); load();
  }
  async function revoke(id: string) {
    await fetch(`${base}/codes`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codeId: id }) });
    load();
  }
  const text = made.map(m => `${m.label ? `${m.label}: ` : ''}${m.code}`).join('\n');

  return (
    <div className={`${card} space-y-3`}>
      <p className="text-sm font-semibold text-slate-200">Access codes</p>
      <p className="text-xs text-slate-500">For people without an account. Each code votes once, at{' '}
        <button type="button" onClick={() => copy('link', link)} title="Click to copy to clipboard"
          className="break-all text-left text-blue-400 underline decoration-blue-400/40 underline-offset-2 hover:text-blue-300">{link}</button>
        {copied === 'link' && <span role="status" className="ml-1.5 font-semibold text-emerald-400">Copied to clipboard</span>}. We keep only a scrambled form, so a code can be shown only when it is made.</p>
      {draft && <p className="text-xs text-amber-300">You can make codes now and send them out; they work once the poll is open.</p>}
      <textarea value={labels} onChange={e => setLabels(e.target.value)} rows={3} placeholder={'One name per line (who each code is for)\nor just a number of codes'} className={`${inputCls} text-xs`} />
      <button className={btnPrimary} disabled={!labels.trim()} onClick={make}>Make codes</button>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      {made.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <p className="mb-1.5 text-amber-200">Copy these now: they won’t be shown again.</p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-slate-100">{text}</pre>
          <button onClick={() => copy('codes', text)} title="Click to copy to clipboard" className="mt-1.5 text-blue-400 hover:underline">Copy all</button>
          {copied === 'codes' && <span role="status" className="ml-2 font-semibold text-emerald-400">Copied to clipboard</span>}
        </div>
      )}
      {codes && codes.length > 0 && (
        <ul className="max-h-60 space-y-1 overflow-auto text-xs">
          {codes.map(c => (
            <li key={c.id} className="flex items-center justify-between gap-2 text-slate-300">
              <span>{c.label || 'Unnamed code'}</span>
              <span className="text-slate-500">
                {c.revoked_at ? 'revoked' : c.used_at ? `voted ${fmtWhen(c.used_at)}` : <button onClick={() => revoke(c.id)} className="text-rose-300 hover:underline">Revoke</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const OUTCOME: Record<string, [string, string]> = {
  carried: ['Carried', 'text-emerald-300'], not_carried: ['Not carried', 'text-rose-300'], elected: ['Elected', 'text-emerald-300'],
  tied: ['Tied', 'text-amber-300'], no_votes: ['No votes', 'text-slate-400'], see_results: ['', 'text-slate-400'],
};

// A formal ballot's outcome: turnout, quorum and each motion or election
function OutcomeCard({ o }: { o: Outcome }) {
  return (
    <div className={`${card} space-y-3`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-200">Outcome</p>
        <p className="text-xs text-slate-400">
          Turnout {o.turnout.voted} of {o.turnout.roll}{o.turnout.pct !== null ? ` (${o.turnout.pct}%)` : ''}
          {o.quorum.required ? ` · quorum ${o.quorum.required}%: ${o.quorum.met ? 'met' : 'not met'}` : ''}
        </p>
      </div>
      {!o.decided && <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">The quorum wasn’t met, so no decision was made.</p>}
      <ul className="space-y-2">
        {o.questions.filter(q => q.outcome !== 'see_results').map(q => {
          const [label, cls] = OUTCOME[q.outcome] ?? ['', ''];
          return (
            <li key={q.questionId} className="text-sm">
              <span className="text-slate-200">{q.text}</span>{' '}
              <span className={`font-semibold uppercase tracking-wide ${o.decided ? cls : 'text-slate-500'}`}>{o.decided ? label : 'No decision'}</span>
              <span className="block text-xs text-slate-400">{q.detail}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Moderators appoint members as scrutineers of a formal ballot
function Scrutineers({ base, initial, locked }: { base: string; initial: { id: string; handle: string }[]; locked: boolean }) {
  const [list, setList] = useState(initial);
  const [handle, setHandle] = useState('');
  const [error, setError] = useState('');
  async function call(method: 'POST' | 'DELETE', body: unknown) {
    setError('');
    const r = await fetch(`${base}/scrutineers`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? 'That didn’t work.'); return; }
    setList(d.scrutineers); setHandle('');
  }
  return (
    <div className={`${card} space-y-2`}>
      <p className="text-sm font-semibold text-slate-200">Scrutineers</p>
      <p className="text-xs text-slate-500">Members who oversee this ballot: they see who has voted (never how), check the count and read the certified result. They can’t change anything.</p>
      <ul className="space-y-1 text-xs text-slate-300">
        {list.length === 0 && <li className="text-slate-500">None yet.</li>}
        {list.map(s => (
          <li key={s.id} className="flex justify-between gap-2"><span>@{s.handle}</span>
            {!locked && <button onClick={() => call('DELETE', { userId: s.id })} className="text-rose-300 hover:underline">Remove</button>}</li>
        ))}
      </ul>
      {!locked && (
        <div className="flex gap-2">
          <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="Member’s username" className={`${inputCls} text-xs`} />
          <button className={btnGhost} disabled={!handle.trim()} onClick={() => call('POST', { handle })}>Add</button>
        </div>
      )}
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
