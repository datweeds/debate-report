import Link from 'next/link';
import { loadSocietyPage } from '@/lib/societyPage';
import { getSocietyDebates, getVisibleSocietyTotals } from '@/components/societies/dashboardParts';
import { sysAdminMayAct } from '@/lib/breakGlass';
import SocietyPrivacyTile from '@/components/societies/SocietyPrivacyTile';
import { redirect } from 'next/navigation';
import { FEATURES } from '@/lib/features';
import DebateMetricsPanel from '@/components/societies/DebateMetricsPanel';
import SocietyDebateList from '@/components/societies/SocietyDebateList';
import { allowsSealed, sealedSection } from '@/lib/sealed/server';

export const dynamic = 'force-dynamic';

// Debate: the Society's totals and its debates.
export default async function SocietyDebatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { society, session, access } = await loadSocietyPage((await params).id);
  // Debate switched off: open the Society on its first feature that's on
  if (access.disabled.includes('debates')) {
    const first = FEATURES.find(f => f.key !== 'debates' && !access.disabled.includes(f.key));
    redirect(`/society/${society.id}/${first?.slug ?? 'about'}`);
  }
  const isSysAdmin = !!session?.isSysAdmin;
  // SysAdmin sees every debate of a public Society; a private one only under break-glass
  const sysAdminSeesAll = isSysAdmin && await sysAdminMayAct(session, society.id);
  const [totals, debates, sealed, allowSealed] = await Promise.all([
    getVisibleSocietyTotals(society.id, session?.sub ?? null, sysAdminSeesAll),
    getSocietyDebates(society.id, session?.sub ?? null, sysAdminSeesAll),
    sealedSection(society.id, 'debates'),
    allowsSealed(society.id),
  ]);
  // Sealed debates are for private Societies; their moderators seal and unseal them
  const canModerate = !!session && access.isModerator && access.isMember;
  const emptyText = totals.hidden > 0
    ? (session ? 'No debates you can see yet. This Society’s other debates are for invited participants.' : 'No public debates yet. Log in or join this Society to see more.')
    : 'No debates in this Society yet.';
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
      {/* What debate here is for */}
      <div className="dr-panel rounded-2xl p-5">
        <h2 className="text-2xl font-extrabold leading-tight tracking-tight">
          <span style={{ color: '#93c5fd' }}>Question,</span>{' '}
          <span style={{ color: '#60a5fa' }}>debate,</span>{' '}
          <span style={{ color: '#2563eb' }}>justify,</span>{' '}
          <span style={{ color: '#00d0ff' }}>understand</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Broaden your mind, deepen your understanding, and justify your position. Interactive debate on the issues that matter.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Arguments are presented visually — pros and cons supported by evidence — so that you can reach a reasoned position.
          Courteous, challenging, and always evidence-led.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Choose a debate to enter, or{' '}
          <Link href="/how-it-works" className="text-blue-400 underline underline-offset-2 hover:text-blue-300">learn how it works</Link>.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Guides:{' '}
          {session ? (
            <>
              <Link href="/guides/member" className="text-blue-400 underline underline-offset-2 hover:text-blue-300">Member</Link>
              {' · '}
              <Link href="/guides/admin" className="text-blue-400 underline underline-offset-2 hover:text-blue-300">Admin</Link>
            </>
          ) : (
            <Link href="/guides/guest" className="text-blue-400 underline underline-offset-2 hover:text-blue-300">Guest guide</Link>
          )}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            { value: 'Public / Private', label: 'debate format', color: 'text-blue-300', bg: 'border-blue-700/40 bg-blue-500/10' },
            { value: 'Moderated', label: 'all content reviewed', color: 'text-amber-300', bg: 'border-amber-700/40 bg-amber-500/10' },
            { value: 'Evidence-led', label: 'claims backed by evidence and data', color: 'text-emerald-300', bg: 'border-emerald-700/40 bg-emerald-500/10' },
            { value: 'AI-assisted', label: 'help building arguments', color: 'text-violet-300', bg: 'border-violet-700/40 bg-violet-500/10' },
          ].map(s => (
            <div key={s.value} className={`rounded-xl border px-2.5 py-2 text-center ${s.bg}`}>
              <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="min-w-0">
        <SocietyDebateList societyId={society.id} debates={debates} sealedId={sealed?.id ?? null} emptyText={emptyText}
          canModerate={canModerate} canSeal={canModerate && society.visibility !== 'public' && allowSealed} />
      </div>
      <div className="lg:col-span-2 xl:col-span-1">
        <DebateMetricsPanel societyId={society.id} />
        <SocietyPrivacyTile societyId={society.id} />
      </div>
    </div>
  );
}
