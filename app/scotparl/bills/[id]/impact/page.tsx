import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import pool, { tq } from '@/lib/db';
import { getSession } from '@/lib/auth';
import ImpactReport from '@/components/scotparl/ImpactReport';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }>; searchParams?: Promise<{ topic_id?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const { rows: [b] } = await pool.query(`SELECT short_name FROM sp_bills WHERE id = $1`, [id]);
  return { title: b ? `Impact Analysis — ${b.short_name}` : 'Impact Analysis' };
}

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);

export default async function BillImpactPage({ params, searchParams }: Params) {
  const session = await getSession().catch(() => null);
  if (!session) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-slate-400 mb-4">Society Impact Analysis is available to registered members.</p>
        <Link href="/register" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors">Register to view</Link>
      </div>
    );
  }

  const { id } = await params;
  const sp = await searchParams;
  const topicId = sp?.topic_id ? parseInt(sp.topic_id, 10) : null;

  const [billRes, analysesRes, topicsRes] = await Promise.all([
    pool.query(`SELECT id, short_name, full_name FROM sp_bills WHERE id = $1`, [id]),
    pool.query(
      `SELECT s.id, s.topic_id, s.status, s.overall_score, s.report, s.notes, s.error_message, s.created_at, s.updated_at, t.name AS topic_name
       FROM society_impact_analyses s JOIN nsp_topics t ON t.id = s.topic_id
       WHERE s.tenant_id = $1 AND s.entity_type = 'bill' AND s.entity_id = $2
       ORDER BY s.updated_at DESC`,
      [TENANT_ID, id]
    ),
    tq(`SELECT id, name FROM nsp_topics ORDER BY sort_order, name`),
  ]);

  const bill = billRes.rows[0];
  if (!bill) notFound();

  const { canManageDebates } = await import('@/lib/roles');
  const canManage = session.isSysAdmin || await canManageDebates(session, TENANT_ID);

  const analyses = analysesRes.rows;
  const active   = topicId ? analyses.find(a => a.topic_id === topicId) : analyses[0] ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/scotparl/bills" className="hover:text-slate-300 transition-colors">Bills</Link>
        <span>/</span>
        <Link href={`/scotparl/bills/${id}`} className="hover:text-slate-300 transition-colors">{bill.short_name}</Link>
        <span>/</span>
        <span className="text-slate-400">Impact Analysis</span>
      </div>

      <ImpactReport
        entityType="bill"
        entityId={parseInt(id, 10)}
        entityTitle={bill.full_name}
        analyses={analyses}
        activeAnalysis={active}
        topics={topicsRes.rows as { id: number; name: string }[]}
        canManage={canManage}
        backHref={`/scotparl/bills/${id}`}
      />
    </div>
  );
}
