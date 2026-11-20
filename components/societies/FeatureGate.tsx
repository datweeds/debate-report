import Link from 'next/link';
import { loadSocietyPage } from '@/lib/societyPage';
import { FEATURES, type FeatureKey } from '@/lib/features';

// Wraps a Society section: if the Society has switched that feature off, say so instead. Server component.
export default async function FeatureGate({ id, feature, children }: { id: string; feature: FeatureKey; children: React.ReactNode }) {
  const { society, access } = await loadSocietyPage(id);
  if (!access.disabled.includes(feature)) return <>{children}</>;
  const label = FEATURES.find(f => f.key === feature)?.label ?? feature;
  return (
    <div className="rounded-2xl border border-slate-800 bg-dr-card p-10 text-center">
      <p className="text-sm text-slate-300">{society.name} doesn’t use {label}.</p>
      {access.isModerator
        ? <p className="mt-2 text-xs text-slate-500">You can switch it on in <Link href={`/dashboard/societies?society=${society.id}`} className="text-blue-400 hover:underline">Manage society → Features</Link>.</p>
        : <p className="mt-2 text-xs text-slate-500"><Link href={`/society/${society.id}/about`} className="text-blue-400 hover:underline">About this Society →</Link></p>}
    </div>
  );
}
