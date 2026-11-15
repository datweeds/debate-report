'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const SOCIETY_SECTIONS = [
  { slug: '',            label: 'Debate & Vote' },
  { slug: 'discussions', label: 'Discussions' },
  { slug: 'documents',   label: 'Documents' },
  { slug: 'events',      label: 'Events' },
  { slug: 'projects',    label: 'Projects' },
  { slug: 'principles',  label: 'Principles' },
] as const;

export function societySectionHref(societyId: number, slug: string) {
  // Debate & Vote is the existing Society dashboard
  return slug ? `/society/${societyId}/${slug}` : `/scotparl?society=${societyId}`;
}

// Tab bar across a Society's sections; scrolls sideways on small screens.
export default function SocietyTabs({ societyId }: { societyId: number }) {
  const pathname = usePathname();
  return (
    <nav className="mt-4 -mx-4 sm:mx-0 overflow-x-auto border-b border-slate-800">
      <div className="flex gap-1 px-4 sm:px-0 min-w-max">
        {SOCIETY_SECTIONS.map(s => {
          const href = societySectionHref(societyId, s.slug);
          const active = s.slug ? pathname.startsWith(`/society/${societyId}/${s.slug}`) : pathname.startsWith('/scotparl');
          return (
            <Link key={s.label} href={href}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                active ? 'border-blue-500 text-blue-300' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}>
              {s.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
