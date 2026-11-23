import pool from '@/lib/db';
import StartSocietyCard from '@/components/StartSocietyCard';
import ReportButton from '@/components/ReportButton';
import { loadSocietyPage } from '@/lib/societyPage';
import SocietyContactForm from '@/components/societies/SocietyContactForm';
import SocietyMetrics from '@/components/societies/SocietyMetrics';

export const dynamic = 'force-dynamic';

// About: the Society's tagline, picture, description, moderators and a way to contact them.
export default async function SocietyAboutPage({ params }: { params: Promise<{ id: string }> }) {
  const { society, session, access } = await loadSocietyPage((await params).id);
  const [{ rows: [extra] }, { rows: moderators }, { rows: [count] }] = await Promise.all([
    pool.query('SELECT description, contact_email IS NOT NULL AND contact_email <> \'\' AS can_contact, created_at FROM customers WHERE id = $1', [society.id]),
    pool.query(
      `SELECT u.user_handle, u.user_full_name FROM customer_roles r JOIN users u ON u.id::text = r.user_id
       WHERE r.tenant_id = $1 AND r.role = 'customer_admin' AND u.age_band IS DISTINCT FROM '13-15' AND u.age_band IS DISTINCT FROM '16-17'
       ORDER BY u.user_handle`, [society.id]),
    pool.query('SELECT COUNT(*)::int AS n FROM customer_members WHERE customer_id = $1', [society.id]),
  ]);
  const visibility = society.visibility === 'public' ? 'Public: anyone can see it'
    : society.visibility === 'apply' ? 'Private: listed publicly, members join by request' : 'Private: by invitation';
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] items-start">
      <div className="space-y-6 min-w-0">
        {society.hero_text && <p className="text-xl sm:text-2xl text-slate-200 leading-relaxed">{society.hero_text}</p>}
        {extra?.description
          ? <div className="rounded-2xl border border-slate-800 bg-dr-card p-5"><p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{extra.description}</p></div>
          : <p className="text-sm text-slate-500">This Society hasn&apos;t written a description yet.</p>}
        <dl className="grid gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-xl border border-slate-800 bg-dr-card px-4 py-3"><dt className="text-[11px] uppercase tracking-wider text-slate-500">Who can see it</dt><dd className="mt-1 text-slate-200">{visibility}</dd></div>
          <div className="rounded-xl border border-slate-800 bg-dr-card px-4 py-3"><dt className="text-[11px] uppercase tracking-wider text-slate-500">Members</dt><dd className="mt-1 text-slate-200">{count.n}</dd></div>
          <div className="rounded-xl border border-slate-800 bg-dr-card px-4 py-3"><dt className="text-[11px] uppercase tracking-wider text-slate-500">Society Admins</dt>
            <dd className="mt-1 text-slate-200">{moderators.map(m => m.user_full_name ? `${m.user_full_name} (@${m.user_handle})` : `@${m.user_handle}`).join(', ') || '—'}</dd></div>
        </dl>
        <SocietyMetrics societyId={society.id} disabled={access.disabled} />
      </div>
      <aside className="space-y-4">
        {society.hero_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={society.hero_image} alt={society.name} className="w-full max-h-[26rem] rounded-2xl border border-slate-800 object-cover" />
        )}
        <div className="rounded-2xl border border-slate-800 bg-dr-card p-5">
          <h2 className="text-sm font-semibold text-slate-200">Contact the Society Admins</h2>
          {extra?.can_contact
            ? <SocietyContactForm societyId={society.id} loggedIn={!!session} />
            : <p className="mt-2 text-xs text-slate-500">This Society hasn&apos;t set up a contact address yet. You can reach its members in Discussions.</p>}
        </div>
        <StartSocietyCard where="about" />
        <div className="px-1"><ReportButton kind="society" id={String(society.id)} what="this Society" label="Report this Society" /></div>
      </aside>
    </div>
  );
}
