'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Home page: what new.vote does to keep Societies' content private.
// The first point depends on whether the master key is kept off our servers.
const ENCRYPTED = {
  server: { icon: '🔐', title: 'Private Societies are encrypted', text: 'Their debates, discussions, documents, events, projects and principles are stored encrypted with each Society’s own key, as are Apply and Invite debates in public Societies.' },
  offline: { icon: '🔐', title: 'Encrypted, with the key kept offline', text: 'Each private Society’s debates, discussions, documents, events, projects and principles, and Apply and Invite debates anywhere, are stored encrypted with the Society’s own key. The master key that unlocks them is never stored on our servers, so a copy of our database or backups, or a seized disk, can’t be read.' },
};
const POINTS = [
  { icon: '🛡️', title: 'No routine admin access', text: 'Our admins can only look inside a private Society in an emergency, with a reason. Every access is logged and shown to the Society.' },
  { icon: '📞', title: 'Private calls', text: 'Calls are encrypted in transit and never recorded. End-to-end encrypted rooms use a passphrase only members know.' },
  { icon: '🤖', title: 'Your AI, your choice', text: 'Each Society uses new.vote’s AI, its own AI provider, or none at all, and can set limits to AI expenditure and track spending.' },
];

export default function PrivacyTile() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    fetch('/api/privacy/status').then(r => r.ok ? r.json() : null).then(d => setOffline(!!d?.keyOffline)).catch(() => {});
  }, []);
  const points = [offline ? ENCRYPTED.offline : ENCRYPTED.server, ...POINTS];
  return (
    <div className="card-dr px-5 py-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Your privacy on new.vote</h2>
          <p className="mt-0.5 text-xs text-slate-500">How Societies keep their conversations their own</p>
        </div>
        <Link href="/privacy" className="text-xs text-blue-500 hover:text-blue-400">Privacy policy →</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {points.map(p => (
          <div key={p.icon} className="flex gap-3 rounded-lg border border-blue-900/15 bg-dr-base/60 px-4 py-3">
            <span className="text-xl leading-none" aria-hidden>{p.icon}</span>
            <div>
              <p className="text-sm font-medium text-slate-200">{p.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{p.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
