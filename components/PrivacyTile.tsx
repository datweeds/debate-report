'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Home page: what new.vote does to keep Societies' content private.
// The first point depends on whether the master key is kept off our servers.
const ENCRYPTED = {
  server: { icon: '🔐', title: 'Private Societies are encrypted', text: 'Their debates, polls, discussions, documents, events, projects and principles are stored encrypted with each Society’s own key, as are members-only discussions and Apply and Invite debates in public Societies.' },
  offline: { icon: '🔐', title: 'Encrypted, with the key kept offline', text: 'Each private Society’s debates, polls, discussions, documents, events, projects and principles, and members-only discussions and Apply and Invite debates anywhere, are stored encrypted with the Society’s own key. The master key that unlocks them is never stored on our servers, so a copy of our database or backups, or a seized disk, can’t be read.' },
};
// End-to-end encryption, for what a group needs to keep from everyone else, us included
const SEALED = {
  icon: '🔏', title: 'Sealed: end-to-end encrypted', highlight: true,
  text: 'A Society can let members seal what matters most. A sealed item is encrypted in members’ own browsers, so only they can read it: not new.vote, and not anyone who gets hold of our servers. Discussions, projects, document folders (files included), polls, the calendar, principles and a private Society’s debates can all be sealed.',
};
const POINTS = [
  { icon: '🛡️', title: 'No routine admin access', text: 'Our admins can only look inside a private Society in an emergency, with a reason, and every access is logged and shown to the Society. Even then, sealed content stays out of reach: Society Admins can turn on sealed items, which are encrypted on members’ own devices and can only ever be read by the Society’s members.' },
  { icon: '🗳️', title: 'Ballots you can trust', text: 'Every ballot is encrypted. In a secret poll your vote is never stored with your name, so Society Admins can’t see how you voted, and your receipt lets you check it was counted. Formal ballots end in a certified result, independently timestamped so anyone can check it hasn’t been changed.' },
  { icon: '📞', title: 'Private calls', text: 'Calls are encrypted in transit and never recorded. End-to-end encrypted rooms use a passphrase only members know.' },
  { icon: '🤖', title: 'Your AI, your choice', text: 'Each Society uses new.vote’s AI, its own AI provider, or none at all, and can set limits to AI expenditure and track spending.' },
];

export default function PrivacyTile() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    fetch('/api/privacy/status').then(r => r.ok ? r.json() : null).then(d => setOffline(!!d?.keyOffline)).catch(() => {});
  }, []);
  const points: { icon: string; title: string; text: string; highlight?: boolean }[] = [offline ? ENCRYPTED.offline : ENCRYPTED.server, SEALED, ...POINTS];
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
          <div key={p.title} className={`flex gap-3 rounded-lg border px-4 py-3 ${p.highlight ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-blue-900/15 bg-dr-base/60'}`}>
            <span className="text-xl leading-none" aria-hidden>{p.icon}</span>
            <div>
              <p className="text-sm font-medium text-slate-200">
                {p.title}
                {p.highlight && <span className="ml-2 rounded-full border border-emerald-500/40 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-emerald-300">New</span>}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{p.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
