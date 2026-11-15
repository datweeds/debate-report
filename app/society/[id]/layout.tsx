import Link from 'next/link';
import { loadSocietyPage } from '@/lib/societyPage';
import SocietyTabs from '@/components/societies/SocietyTabs';

// Frame for a Society's sections: name, then a tab bar across Debate & Vote,
// Discussions, Documents, Events, Projects and Principles.
export default async function SocietyLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ id: string }>;
}) {
  const { society, access } = await loadSocietyPage((await params).id);
  return (
    <div className="px-4 sm:px-8 py-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link href="/scotparl" className="text-xs text-slate-500 hover:text-slate-300">← All societies</Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mt-1 truncate">{society.name}</h1>
        </div>
        {access.isModerator && (
          <Link href={`/dashboard/societies?society=${society.id}`} className="text-xs text-blue-400 hover:text-blue-300">Manage society →</Link>
        )}
      </div>
      <SocietyTabs societyId={society.id} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
