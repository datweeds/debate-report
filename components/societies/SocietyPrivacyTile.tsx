import Link from 'next/link';
import pool from '@/lib/db';
import { keyHeldOffline } from '@/lib/masterKey';

// A Society's home page: how its content is protected, in a few lines. Server component.
export default async function SocietyPrivacyTile({ societyId }: { societyId: number }) {
  const { rows: [r] } = await pool.query(
    `SELECT c.visibility,
            COALESCE((SELECT mode FROM society_ai WHERE customer_id = c.id), 'platform') AS ai_mode,
            (SELECT count(*)::int FROM society_rtc_rooms WHERE customer_id = c.id AND e2ee AND deleted_at IS NULL) AS e2ee_rooms,
            (SELECT count(*)::int FROM sysadmin_access WHERE customer_id = c.id AND created_at > now() - interval '90 days') AS emergency
     FROM customers c WHERE c.id = $1`, [societyId]);
  if (!r) return null;
  const priv = r.visibility !== 'public';
  const lines = [
    priv
      ? { icon: '🔐', text: keyHeldOffline()
          ? 'Private: debates, discussions, documents, events, projects and principles are stored encrypted with this Society’s own key. The master key that unlocks it is kept offline, never on our servers.'
          : 'Private: debates, discussions, documents, events, projects and principles are stored encrypted with this Society’s own key.' }
      : { icon: '🌐', text: 'Public: anyone can read this Society. Its Apply and Invite debates are stored encrypted; moderators can make the whole Society private to encrypt everything.' },
    priv
      ? { icon: '🛡️', text: r.emergency ? `Emergency admin access: ${r.emergency} in the last 90 days, each logged with a reason.` : 'No emergency admin access in the last 90 days.' }
      : { icon: '🛡️', text: 'Admins act only as a takedown backstop for public content.' },
    { icon: '📞', text: r.e2ee_rooms ? `Calls are never recorded; ${r.e2ee_rooms} end-to-end encrypted ${r.e2ee_rooms === 1 ? 'room' : 'rooms'}.` : 'Calls are encrypted in transit and never recorded.' },
    { icon: '🤖', text: r.ai_mode === 'own' ? 'AI: this Society’s own provider.' : r.ai_mode === 'off' ? 'AI: switched off for this Society.' : 'AI: new.vote’s AI.' },
  ];
  return (
    <div className="mt-4 rounded-2xl border border-slate-800 bg-[#0c1322] p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-200">Privacy</p>
        <Link href="/privacy" className="text-[11px] text-blue-400 hover:text-blue-300">Policy →</Link>
      </div>
      <ul className="space-y-1.5 text-xs text-slate-400">
        {lines.map(l => (
          <li key={l.icon} className="flex gap-2"><span aria-hidden>{l.icon}</span><span>{l.text}</span></li>
        ))}
      </ul>
    </div>
  );
}
