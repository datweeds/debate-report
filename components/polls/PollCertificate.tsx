'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Cert = { document: string; digest: string; tsa_url: string | null; tsa_time: string | null; has_timestamp: boolean; certified_at: string; manager: boolean };
type Opt = { id: string; text: string; count: number; pct: number };
type Doc = {
  society: { name: string };
  ballot: { title: string; description: string | null; secret: boolean; opened_at: string | null; closed_at: string | null; voters_could_change_vote: boolean; access_codes: boolean };
  rules: { quorum_pct: number | null; majority_for_motions: string };
  voter_roll: { members: number; access_codes: number; total: number };
  turnout: { voted: number; roll: number; pct: number | null };
  quorum: { required: number | null; met: boolean | null };
  decided: boolean;
  outcomes: { questionId: string; text: string; outcome: string; detail: string }[];
  results: { questionId: string; questionText: string; type: string; responses: number; options?: Opt[]; average?: number }[];
  audit: { counted_ballots: number; replaced_ballots: number; receipts_sha256: string; checks: { label: string; ok: boolean; detail: string }[] };
  scrutineers: string[]; certified_by: string | null; certified_at: string;
};

const when = (s: string | null) => (s ? new Date(s).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' }) : '—');
const OUTCOME: Record<string, [string, string]> = {
  carried: ['Carried', 'text-emerald-300 print:text-emerald-800'], not_carried: ['Not carried', 'text-rose-300 print:text-rose-800'],
  elected: ['Elected', 'text-emerald-300 print:text-emerald-800'], tied: ['Tied', 'text-amber-300 print:text-amber-800'],
  no_votes: ['No votes', 'text-slate-400'], see_results: ['Result', 'text-slate-300 print:text-slate-800'],
};

// A formal ballot's certified result: printable, with the files to check it independently.
export default function PollCertificate({ societyId, pollId }: { societyId: number; pollId: string }) {
  const base = `/api/societies/${societyId}/polls/${pollId}/certificate`;
  const [c, setC] = useState<Cert | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(base, { cache: 'no-store' });
    if (r.ok) setC(await r.json()); else setError(r.status === 404 ? 'This result hasn’t been certified.' : 'Couldn’t load the certificate.');
  }, [base]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <p className="text-sm text-rose-300">{error}</p>;
  if (!c) return <div className="h-60 animate-pulse rounded-2xl bg-slate-800/40" />;
  const d: Doc = JSON.parse(c.document);
  const sect = 'rounded-xl border border-slate-800 p-4 print:border-slate-300';
  return (
    <div className="mx-auto max-w-3xl space-y-5 print:max-w-none print:text-black">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/society/${societyId}/polls/${pollId}`} className="text-xs text-slate-500 hover:text-slate-300">← {d.ballot.title}</Link>
        <div className="flex flex-wrap gap-2 text-xs">
          <button onClick={() => window.print()} className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-200 hover:border-slate-400">Print or save as PDF</button>
          <a href={`${base}?file=json`} className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-200 hover:border-slate-400">Certified document (.json)</a>
          {c.has_timestamp && <a href={`${base}?file=tsr`} className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-200 hover:border-slate-400">Timestamp (.tsr)</a>}
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-300 print:text-amber-800">Certified ballot result</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-100 print:text-black">{d.ballot.title}</h1>
        <p className="mt-1 text-sm text-slate-400 print:text-slate-700">{d.society.name}</p>
        {d.ballot.description && <p className="mx-auto mt-2 max-w-2xl whitespace-pre-line text-sm text-slate-400 print:text-slate-700">{d.ballot.description}</p>}
      </div>

      <div className={`${sect} grid gap-3 text-sm sm:grid-cols-2`}>
        <p><span className="text-slate-500">Voting opened</span><br />{when(d.ballot.opened_at)}</p>
        <p><span className="text-slate-500">Voting closed</span><br />{when(d.ballot.closed_at)}</p>
        <p><span className="text-slate-500">Voter roll (fixed when voting opened)</span><br />{d.voter_roll.total} ({d.voter_roll.members} members{d.voter_roll.access_codes ? `, ${d.voter_roll.access_codes} access codes` : ''})</p>
        <p><span className="text-slate-500">Turnout</span><br />{d.turnout.voted} voted{d.turnout.pct !== null ? ` (${d.turnout.pct}%)` : ''}</p>
        <p><span className="text-slate-500">Quorum</span><br />{d.quorum.required ? `${d.quorum.required}% of the roll: ${d.quorum.met ? 'met' : 'NOT met'}` : 'None set'}</p>
        <p><span className="text-slate-500">Ballot</span><br />{d.ballot.secret ? 'Secret' : 'Named'}; motions need {d.rules.majority_for_motions} of votes cast</p>
      </div>

      {!d.decided && (
        <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200 print:text-rose-800">
          The quorum was not met, so no decision was made. The votes cast are recorded below.
        </p>
      )}

      <div className="space-y-3">
        {d.results.map(r => {
          const o = d.outcomes.find(x => x.questionId === r.questionId);
          const [label, cls] = OUTCOME[o?.outcome ?? 'see_results'] ?? OUTCOME.see_results;
          return (
            <div key={r.questionId} className={sect}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-slate-100 print:text-black">{r.questionText}</p>
                <p className={`text-sm font-bold uppercase tracking-wide ${cls}`}>{d.decided ? label : 'No decision'}</p>
              </div>
              {o && <p className="mt-1 text-sm text-slate-300 print:text-slate-800">{o.detail}</p>}
              {r.options && r.options.length > 0 && (
                <table className="mt-2 w-full text-sm">
                  <tbody>
                    {r.options.map(op => (
                      <tr key={op.id} className="border-t border-slate-800 print:border-slate-200">
                        <td className="py-1 text-slate-300 print:text-slate-800">{op.text}</td>
                        <td className="py-1 text-right tabular-nums text-slate-200 print:text-black">{op.count}</td>
                        <td className="w-16 py-1 text-right tabular-nums text-slate-500">{op.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {r.average !== undefined && <p className="mt-1 text-sm text-slate-400">Average {r.average}</p>}
              <p className="mt-1 text-xs text-slate-500">{r.responses} responses</p>
            </div>
          );
        })}
      </div>

      <div className={`${sect} space-y-2 text-sm`}>
        <p className="font-semibold text-slate-200 print:text-black">Checks at certification</p>
        <ul className="space-y-0.5 text-xs">
          {d.audit.checks.map(x => <li key={x.label} className="flex justify-between gap-2"><span>{x.ok ? '✓' : '✕'} {x.label}</span><span className="tabular-nums text-slate-500">{x.detail}</span></li>)}
        </ul>
        <p className="text-xs text-slate-400 print:text-slate-700">
          {d.audit.counted_ballots} ballots counted{d.audit.replaced_ballots ? ` (${d.audit.replaced_ballots} earlier ballots replaced when voters changed their vote)` : ''}.
          Each voter can find their receipt in the <Link href={`/society/${societyId}/polls/${pollId}/audit`} className="text-blue-400 hover:underline">audit log</Link>.
          SHA-256 of the counted receipts: <span className="break-all font-mono">{d.audit.receipts_sha256}</span>
        </p>
        <p className="text-xs text-slate-400 print:text-slate-700">Scrutineers: {d.scrutineers.length ? d.scrutineers.join(', ') : 'none appointed'}. Certified by {d.certified_by ?? 'a Society Admin'} on {when(d.certified_at)}.</p>
      </div>

      <div className={`${sect} space-y-2 text-xs text-slate-400 print:text-slate-700`}>
        <p className="text-sm font-semibold text-slate-200 print:text-black">Proof this result hasn’t changed</p>
        <p>SHA-256 of the certified document: <span className="break-all font-mono text-slate-200 print:text-black">{c.digest}</span></p>
        {c.has_timestamp ? (
          <p>Independently timestamped by <span className="text-slate-200 print:text-black">{c.tsa_url ? new URL(c.tsa_url).host : 'a timestamp authority'}</span>{c.tsa_time ? ` at ${when(c.tsa_time)}` : ''}: the authority signed this hash at that time, so the result can’t have been changed since.</p>
        ) : (
          <p className="text-amber-300">The timestamp authority couldn’t be reached when this was certified, so it has no independent timestamp yet.
            {c.manager && <button disabled={busy} onClick={async () => { setBusy(true); await fetch(base, { method: 'POST' }); setBusy(false); void load(); }} className="ml-2 text-blue-400 hover:underline print:hidden">{busy ? 'Trying…' : 'Try again'}</button>}
          </p>
        )}
        <details className="print:hidden">
          <summary className="cursor-pointer text-slate-300">How to check it yourself</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Download the certified document (.json) and the timestamp (.tsr).</li>
            <li>The document’s SHA-256 must equal the hash above: <code className="font-mono">sha256sum ballot-…-certified.json</code></li>
            <li>Check the timestamp with OpenSSL and the authority’s certificates (for FreeTSA, cacert.pem and tsa.crt from freetsa.org):<br />
              <code className="break-all font-mono">openssl ts -verify -data ballot-…-certified.json -in ballot-…-certified.tsr -CAfile cacert.pem -untrusted tsa.crt</code></li>
          </ol>
        </details>
      </div>
    </div>
  );
}
