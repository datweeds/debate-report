import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import PrinciplesPage from '@/components/scotparl/PrinciplesPage';

export const metadata: Metadata = { title: 'New Society Principles' };
export const dynamic = 'force-dynamic';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);

export default async function PrinciplesRoute() {
  const session = await getSession().catch(() => null);
  const { canManageDebates } = await import('@/lib/roles');
  const canManage = session ? (session.isSysAdmin || await canManageDebates(session, TENANT_ID)) : false;

  return (
    <PrinciplesPage
      userId={session?.sub ?? null}
      userHandle={session?.handle ? `@${session.handle}` : null}
      isSysAdmin={session?.isSysAdmin ?? false}
      canManage={canManage}
    />
  );
}
