import Link from 'next/link';
import { loadSocietyPage } from '@/lib/societyPage';
import SocietyFrame from '@/components/societies/SocietyFrame';
import BreakGlassBanner from '@/components/societies/BreakGlassBanner';
import LockedBanner from '@/components/societies/LockedBanner';
import DemoBanner from '@/components/societies/DemoBanner';
import { isUnlocked } from '@/lib/masterKey';

// Frame for a Society's sections. The Society's name is the page's top title
// (in the site header); below it, the section tabs, then the section itself.
export default async function SocietyLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ id: string }>;
}) {
  const { society, access, session } = await loadSocietyPage((await params).id);
  return (
    <div className="px-4 sm:px-6 lg:px-10 pt-2 pb-8 max-w-[1800px] mx-auto">
      {access.breakGlass && <BreakGlassBanner societyId={society.id} until={access.breakGlass} />}
      {access.visibility !== 'public' && !isUnlocked() && <LockedBanner />}
      {access.isDemo && <DemoBanner loggedIn={!!session} />}
      {access.closed && (
        <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          This Society is <strong>closed</strong>: only its moderators can see it.{' '}
          <Link href={`/dashboard/societies?society=${society.id}`} className="font-semibold text-blue-300 hover:underline">Reopen it in Manage society</Link>
        </p>
      )}
      <SocietyFrame
        societyId={society.id}
        slug={society.slug}
        disabled={access.disabled}
        loggedIn={access.isMember || access.isModerator || access.visibility === 'public'}
        manage={access.isModerator ? (
          <Link href={`/dashboard/societies?society=${society.id}`} className="text-xs text-blue-400 hover:text-blue-300">Manage society →</Link>
        ) : null}
      />
      <div className="mt-6">{children}</div>
    </div>
  );
}
