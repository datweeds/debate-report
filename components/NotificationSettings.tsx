'use client';

import { useCallback, useEffect, useState } from 'react';

type Settings = {
  publicKey: string | null; kinds: { id: string; label: string }[]; societies: { id: number; name: string }[];
  mutedKinds: string[]; mutedSocieties: number[]; devices: number;
};

// The site's public push key, in the form browsers want
function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob((b64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Notifications on this device (browser or phone), and what to be notified about
export default function NotificationSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [support, setSupport] = useState<'checking' | 'yes' | 'no' | 'ios-install'>('checking');
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [onHere, setOnHere] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/push');
    if (r.ok) setS(await r.json());
  }, []);

  // Opened from the menu's "Notifications" link: bring this card into view once it's drawn
  useEffect(() => {
    if (window.location.hash === '#notifications') setTimeout(() => document.getElementById('notifications')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  }, []);

  useEffect(() => {
    void load();
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const can = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (ios && !installed) { setSupport('ios-install'); return; }
    if (!can) { setSupport('no'); return; }
    setSupport('yes');
    setPermission(Notification.permission);
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => setOnHere(!!sub)).catch(() => {});
  }, [load]);

  async function switchOn() {
    const siteKey = s?.publicKey;
    if (!siteKey) { setNote('Notifications aren’t set up on the server yet.'); return; }
    setBusy(true); setNote('');
    try {
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p !== 'granted') { setNote('Your browser didn’t allow notifications. You can change this in its site settings.'); return; }
      // Some browsers never answer if their push service can't be reached: give up after 20 seconds
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('your browser didn’t respond. Check you’re online, then try again.')), 20000));
      const sub = await Promise.race([timeout, (async () => {
        const reg = await navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready);
        return await reg.pushManager.getSubscription()
          ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(siteKey) });
      })()]);
      const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Couldn’t save');
      setOnHere(true);
      setNote('Notifications are on for this device.');
      void load();
    } catch (e) {
      setNote(`Couldn’t switch notifications on: ${(e as Error).message}`);
    } finally { setBusy(false); }
  }

  async function switchOff() {
    setBusy(true); setNote('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setOnHere(false);
      setNote('Notifications are off for this device.');
      void load();
    } finally { setBusy(false); }
  }

  async function test() {
    const r = await fetch('/api/push/test', { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    setNote(d.sent ? `Test sent to ${d.sent} device${d.sent === 1 ? '' : 's'}.` : 'No devices have notifications switched on.');
  }

  async function savePrefs(next: Pick<Settings, 'mutedKinds' | 'mutedSocieties'>) {
    setS(v => v ? { ...v, ...next } : v);
    await fetch('/api/push', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
  }
  const toggle = <T,>(list: T[], v: T) => list.includes(v) ? list.filter(x => x !== v) : [...list, v];

  return (
    <section id="notifications" className="rounded-2xl border border-slate-800 bg-dr-card p-5">
      <h2 className="text-base font-semibold text-slate-100">🔔 Notifications</h2>
      <p className="mt-1 text-sm text-slate-400">
        Get a notification on this device when something new is added to your Societies. Notifications about private content
        say only what’s new and where, never its text.
      </p>

      <div className="mt-4 rounded-xl border border-slate-800 p-3">
        {support === 'checking' && <p className="text-sm text-slate-500">Checking this device…</p>}
        {support === 'no' && <p className="text-sm text-slate-400">This browser can’t show notifications. Try a current Chrome, Edge, Firefox or Safari.</p>}
        {support === 'ios-install' && (
          <div className="text-sm text-slate-300">
            <p className="font-semibold text-slate-100">On iPhone and iPad, add new.vote to your Home Screen first</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-400">
              <li>In Safari, tap the Share button (the square with an arrow).</li>
              <li>Choose <span className="text-slate-200">Add to Home Screen</span>, then <span className="text-slate-200">Add</span>.</li>
              <li>Open new.vote from the new icon, come back to this page and switch notifications on.</li>
            </ol>
            <p className="mt-2 text-xs text-slate-500">Apple only allows website notifications for sites added to the Home Screen (iOS 16.4 or later).</p>
          </div>
        )}
        {support === 'yes' && (
          <div className="flex flex-wrap items-center gap-3">
            <span className={`text-sm font-semibold ${onHere ? 'text-emerald-300' : 'text-slate-300'}`}>
              {onHere ? 'On for this device' : permission === 'denied' ? 'Blocked by this browser' : 'Off for this device'}
            </span>
            {onHere ? (
              <>
                <button onClick={test} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500">Send a test</button>
                <button onClick={switchOff} disabled={busy} className="text-xs text-slate-400 hover:text-rose-300">Switch off</button>
              </>
            ) : permission === 'denied' ? (
              <span className="text-xs text-slate-500">Allow notifications for new.vote in your browser’s site settings, then reload this page.</span>
            ) : (
              <button onClick={switchOn} disabled={busy} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
                {busy ? 'Switching on…' : 'Switch on'}
              </button>
            )}
          </div>
        )}
        {note && <p className="mt-2 text-xs text-slate-300">{note}</p>}
        {s && s.devices > 0 && <p className="mt-1 text-xs text-slate-500">On for {s.devices} device{s.devices === 1 ? '' : 's'} in all.</p>}
      </div>

      {s && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Notify me about</p>
            <ul className="space-y-1.5">
              {s.kinds.map(k => (
                <li key={k.id}>
                  <label className="flex items-start gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={!s.mutedKinds.includes(k.id)} className="mt-1 accent-blue-500"
                      onChange={() => savePrefs({ mutedKinds: toggle(s.mutedKinds, k.id), mutedSocieties: s.mutedSocieties })} />
                    {k.label}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">From these Societies</p>
            {s.societies.length === 0 ? <p className="text-sm text-slate-500">You haven’t joined a Society yet.</p> : (
              <ul className="space-y-1.5">
                {s.societies.map(c => (
                  <li key={c.id}>
                    <label className="flex items-start gap-2 text-sm text-slate-300">
                      <input type="checkbox" checked={!s.mutedSocieties.includes(c.id)} className="mt-1 accent-blue-500"
                        onChange={() => savePrefs({ mutedKinds: s.mutedKinds, mutedSocieties: toggle(s.mutedSocieties, c.id) })} />
                      {c.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
