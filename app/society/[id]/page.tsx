import Link from 'next/link';
import { loadSocietyPage } from '@/lib/societyPage';
import { emptyLozenges, emptyMetrics, getLozengesBySociety, getMetricsBySociety, getSocietyDebates, SocietySection } from '@/components/societies/dashboardParts';

export const dynamic = 'force-dynamic';

// Debate & Vote: the Society's totals and its debates.
export default async function SocietyDebatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { society, session } = await loadSocietyPage((await params).id);
  const isSysAdmin = !!session?.isSysAdmin;
  const [metrics, lozenges, debates] = await Promise.all([
    getMetricsBySociety(), getLozengesBySociety(),
    getSocietyDebates(society.id, session?.sub ?? null, isSysAdmin),
  ]);
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] items-start">
      <div className="space-y-3 min-w-0 order-2 xl:order-1">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Select a debate</p>
        {debates.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No debates in this Society yet.</p>
        ) : (
          <div className="divide-y divide-slate-800/60 rounded-2xl border border-slate-800 bg-[#0c1322] overflow-hidden">
            {debates.map(d => (
              <Link key={d.id} href={`/chamber?resolution=${d.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-800/40 transition-colors">
                <span className="text-sm text-slate-200">{d.stat_title}</span>
                <span className="flex items-center gap-3 text-xs text-slate-500 flex-shrink-0">
                  <span className="text-emerald-500">{d.vote_for}↑</span>
                  <span className="text-rose-500">{d.vote_against}↓</span>
                  <span>{d.child_count} statements</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className="order-1 xl:order-2">
        <SocietySection
          title="Totals"
          metrics={metrics.get(society.id) ?? emptyMetrics()}
          lozenges={lozenges.get(society.id) ?? emptyLozenges()}
          isSysAdmin={isSysAdmin}
          societyId={society.id}
        />
      </div>
    </div>
  );
}
