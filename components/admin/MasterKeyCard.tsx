'use client';

import { useCallback, useEffect, useState } from 'react';

type Status = { unlocked: boolean; storedOnServer: boolean; source: 'server' | 'memory' | null; log: { id: string; action: string; created_at: string; handle: string | null }[] };

const fmt = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const ACTIONS: Record<string, string> = {
  loaded: 'Loaded from the server at start-up', unlocked: 'Unlocked', locked: 'Locked', stored: 'Stored on the server',
  removed: 'Removed from the server', revealed: 'Shown to copy', failed: 'Wrong key supplied',
};

// SysAdmin: the master key that unlocks private Societies, and where it's kept
export default function MasterKeyCard() {
  const [s, setS] = useState<Status | null>(null);
  const [keyText, setKeyText] = useState('');
  const [shown, setShown] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/master-key', { cache: 'no-store' });
    if (r.ok) setS(await r.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(action: string, key?: string) {
    setError(''); setBusy(true);
    const r = await fetch('/api/admin/master-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, key }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(d.error ?? 'That didn’t work.'); return null; }
    setKeyText(''); setRemoving(false);
    if (action !== 'reveal') setShown(null);
    await load();
    return d;
  }

  if (!s) return <div className="h-24 rounded-xl bg-slate-800/40 animate-pulse" />;
  const keyInput = (placeholder: string) => (
    <input type="password" value={keyText} onChange={e => setKeyText(e.target.value)} placeholder={placeholder} autoComplete="off" spellCheck={false}
      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100" />
  );

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Master key</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs ${!s.unlocked ? 'bg-rose-500/15 text-rose-300' : s.storedOnServer ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
          {!s.unlocked ? '🔒 Locked' : s.storedOnServer ? 'Unlocked · key stored on this server' : 'Unlocked · key held offline'}
        </span>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-slate-400">
        Every private Society’s key is wrapped by this master key. Held offline, it is never written to this server:
        after each restart, paste it here to unlock private Societies. Until then their content stays locked and nothing is lost.
        Stored on the server, restarts need nobody, which suits development, but anyone who takes the server takes the key.
        The privacy tiles and policy describe whichever is true.
      </p>

      {!s.unlocked && (
        <div className="space-y-2">
          {keyInput('Paste the master key')}
          <button disabled={busy || !keyText} onClick={() => act('unlock', keyText)}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">Unlock private Societies</button>
        </div>
      )}

      {s.unlocked && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={async () => { const d = await act('reveal'); if (d) setShown(d.key); }}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">Show key to save a copy</button>
            {s.storedOnServer ? (
              <button disabled={busy} onClick={() => { setRemoving(!removing); setKeyText(''); setError(''); }}
                className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10">Remove key from server…</button>
            ) : (
              <>
                <button disabled={busy} onClick={() => act('store')}
                  className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/10">Store key on server (development)</button>
                <button disabled={busy} onClick={() => act('lock')}
                  className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10">Lock now</button>
              </>
            )}
          </div>

          {shown && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-slate-300">
              <p className="mb-2">Save this in your password manager and keep a second copy offline. If every copy is lost, private Societies’ content can never be read again.</p>
              <code className="block break-all rounded bg-slate-900 px-2 py-1.5 font-mono text-slate-100">{shown}</code>
              <div className="mt-2 flex gap-3">
                <button onClick={() => navigator.clipboard.writeText(shown)} className="text-blue-400 hover:underline">Copy</button>
                <button onClick={() => setShown(null)} className="text-slate-400 hover:underline">Hide</button>
              </div>
            </div>
          )}

          {removing && (
            <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-xs text-slate-300">
                Paste your saved copy to prove it’s correct. The server copy is then deleted; the key stays in memory until the next restart, when it must be pasted here again.
              </p>
              {keyInput('Paste your saved copy of the key')}
              <button disabled={busy || !keyText} onClick={() => act('remove', keyText)}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">Delete the server copy</button>
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

      {s.log.length > 0 && (
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-300">Key log</summary>
          <ul className="mt-2 space-y-1 text-slate-400">
            {s.log.map(e => (
              <li key={e.id}>{fmt(e.created_at)} · {ACTIONS[e.action] ?? e.action}{e.handle && ` · @${e.handle}`}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
