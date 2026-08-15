import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { tq } from '@/lib/db';
import { getSession } from '@/lib/auth';
import NewProposalForm from '@/components/proposals/NewProposalForm';

export const metadata: Metadata = { title: 'New Proposal' };
export const dynamic = 'force-dynamic';

export default async function NewProposalPage() {
  const session = await getSession().catch(() => null);
  if (!session) redirect('/login');

  const { rows: topics } = await tq<{ id: number; name: string }>(
    `SELECT id, name FROM nsp_topics ORDER BY sort_order, name`
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/scotparl/proposals" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
          ← Proposals
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-100">New Proposal</h1>
        <p className="mt-1 text-sm text-slate-400">
          Proposals are private until accepted by an administrator.
        </p>
      </div>
      <div className="card-dr px-6 py-5">
        <NewProposalForm topics={topics} basePath="/scotparl/proposals" />
      </div>
    </div>
  );
}
