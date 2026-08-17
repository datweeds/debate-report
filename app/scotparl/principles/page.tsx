import type { Metadata } from 'next';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import PrinciplesPage from '@/components/scotparl/PrinciplesPage';

export const metadata: Metadata = { title: 'Principles' };
export const dynamic = 'force-dynamic';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);

export default async function PrinciplesRoute() {
  const [sessionRes, nameRes] = await Promise.all([
    getSession().catch(() => null),
    pool.query<{ name: string }>(`SELECT name FROM customers WHERE id = $1`, [TENANT_ID]).catch(() => ({ rows: [] })),
  ]);
  const session  = sessionRes;
  const siteName = nameRes.rows[0]?.name ?? null;
  const { canManageDebates } = await import('@/lib/roles');
  const canManage = session ? (session.isSysAdmin || await canManageDebates(session, TENANT_ID)) : false;

  return (
    <PrinciplesPage
      userId={session?.sub ?? null}
      userHandle={session?.handle ? `@${session.handle}` : null}
      isSysAdmin={session?.isSysAdmin ?? false}
      canManage={canManage}
      siteName={siteName}
    />
  );
}
