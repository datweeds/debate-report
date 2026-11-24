'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Status = { enabled: boolean; due: boolean; reason: string | null; band: string | null; checked: boolean; method: string | null;
  methods: { wallet: boolean; face: { id: string; label: string } | null } };
const REASONS: Record<string, string> = {
  'band-up': 'You changed your age group to 18 or over.',
  score: 'Something on your account suggests your age group may be wrong.',
  'stated-16-17': 'Something you wrote suggests your age group may be wrong.',
};

// Confirm your age: wallet proof first, then the face check on your device.
export default function AgeCheckPage() {
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [test, setTest] = useState<{ sessionId: string } | null>(null);
  const [testAge, setTestAge] = useState('25');
  const load = () => fetch('/api/age-check').then(r => r.ok ? r.json() : null).then(setS).catch(() => setS(null));
  useEffect(() => { void load(); }, []);
  const hasDcApi = typeof window !== 'undefined' && 'DigitalCredential' in window;

  async function finish(sessionId: string, response: unknown) {
    const r = await fetch('/api/age-check/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, response }) });
    const d = await r.json().catch(() => ({}));
    if (d.held) { window.location.href = '/'; return; }
    if (d.fallback) setMsg({ ok: false, text: 'The face check couldn’t confirm your age. Please try a digital wallet, or contact us for another way.' });
    else if (!r.ok) setMsg({ ok: false, text: d.error ?? 'That didn’t work. Please try again.' });
    else setMsg({ ok: true, text: d.band === '18+' ? 'Thank you: you’re confirmed as 18 or over.' : 'Thank you: you’re confirmed as 16 or 17.' });
    void load();
  }
  async function wallet() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/age-check/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'wallet' }) });
      const d = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: d.error ?? 'Couldn’t start' }); return; }
      // The browser asks your wallet; you see exactly what's asked, and approve it there
      const cred = await (navigator.credentials as unknown as { get(o: unknown): Promise<{ data: unknown } | null> })
        .get({ mediation: 'required', digital: { requests: [d.request] } });
      if (!cred) { setMsg({ ok: false, text: 'No answer from your wallet.' }); return; }
      await finish(d.sessionId, typeof cred.data === 'string' ? JSON.parse(cred.data) : cred.data);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).name === 'NotAllowedError' ? 'You cancelled, or your wallet has no age credential.' : 'Your browser or wallet couldn’t do this. Try the face check instead.' });
    } finally { setBusy(false); }
  }
  async function face() {
    setBusy(true); setMsg(null);
    const r = await fetch('/api/age-check/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'face' }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: d.error ?? 'Couldn’t start' }); return; }
    if (d.client?.kind === 'test') setTest({ sessionId: d.sessionId });
    // A real provider's on-device SDK starts here (its adapter supplies the client part)
  }

  if (!s) return <div className="mx-auto max-w-2xl px-4 py-10"><div className="h-40 animate-pulse rounded-2xl bg-slate-800/40" /></div>;
  const btn = 'rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50';
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-100">Confirm your age</h1>
      {s.checked && !s.due ? (
        <p className="rounded-xl border border-emerald-600/40 bg-emerald-950/20 p-4 text-sm text-emerald-200">Your age is confirmed ({s.band === '18+' ? '18 or over' : '16 or 17'}). There’s nothing more to do.</p>
      ) : (
        <>
          <p className="text-sm text-slate-300">
            {s.reason && REASONS[s.reason] ? `${REASONS[s.reason]} ` : ''}UK law (the Online Safety Act) asks us to check ages reliably before some features,
            such as joining a local Society. We learn only your age group, never your name or date of birth.{' '}
            <Link href="/guides/age-check" className="text-blue-400 hover:text-blue-300">How this works, and your privacy</Link>.
          </p>
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-dr-card p-5">
            <h2 className="text-sm font-semibold text-slate-100">1. With a digital wallet <span className="font-normal text-slate-500">(most private)</span></h2>
            <p className="text-xs text-slate-400">Shares only “over 16” and “over 18” yes/no answers from an ID in your phone’s wallet (for example Google Wallet with an ID pass). On a computer, your browser shows a code to scan with your phone.</p>
            <button onClick={wallet} disabled={busy || !s.methods.wallet || !hasDcApi} className={`${btn} bg-blue-600 text-white hover:bg-blue-500`}>Prove with a wallet</button>
            {!s.methods.wallet ? <p className="text-[11px] text-slate-500">Not available yet.</p> : !hasDcApi && <p className="text-[11px] text-slate-500">This browser can’t ask a wallet. Try Chrome on Android, or the face check.</p>}
          </div>
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-dr-card p-5">
            <h2 className="text-sm font-semibold text-slate-100">2. With a face check on your device</h2>
            <p className="text-xs text-slate-400">A short selfie, checked on your own phone or computer: your face never leaves it. We receive only the result.</p>
            <button onClick={face} disabled={busy || !s.methods.face} className={`${btn} border border-slate-600 text-slate-200 hover:border-blue-500/60`}>Start the face check</button>
            {!s.methods.face && <p className="text-[11px] text-slate-500">Not available yet.</p>}
            {test && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-700/40 bg-amber-950/10 p-3 text-xs text-amber-200">
                Test provider (no real check): estimated age
                <input value={testAge} onChange={e => setTestAge(e.target.value)} className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200" />
                <button onClick={() => { const t = test; setTest(null); void finish(t.sessionId, { age: Number(testAge) }); }} className="rounded border border-amber-600/60 px-2 py-1">Submit</button>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500">Neither works for you? <Link href="/contact" className="text-blue-400 hover:text-blue-300">Contact us</Link> and we’ll find another way.</p>
        </>
      )}
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-950/30 text-emerald-200' : 'bg-rose-950/30 text-rose-200'}`}>{msg.text}</p>}
    </div>
  );
}
