'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const SOCIETY_SECTIONS = [
  { slug: '',            label: 'Debate & Vote' },
  { slug: 'news',        label: 'News' },
  { slug: 'discussions', label: 'Discussions' },
  { slug: 'documents',   label: 'Documents' },
  { slug: 'events',      label: 'Events' },
  { slug: 'projects',    label: 'Projects' },
  { slug: 'principles',  label: 'Principles' },
  { slug: 'about',       label: 'About' },
] as const;

export function societySectionHref(societyId: number, slug: string) {
  return slug ? `/society/${societyId}/${slug}` : `/society/${societyId}`;
}

export function isSectionActive(pathname: string, societyId: number, slug: string) {
  return slug ? pathname.startsWith(`/society/${societyId}/${slug}`) : pathname === `/society/${societyId}`;
}

// Tab bar across a Society's sections; scrolls sideways on small screens.
// `counts` shows new items per section since the viewer last looked.
export default function SocietyTabs({ societyId, counts, right }: {
  societyId: number; counts?: Record<string, number>; right?: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="flex items-end gap-3 border-b border-slate-800">
      <nav className="-mx-4 sm:mx-0 min-w-0 flex-1 overflow-x-auto">
        <div className="flex gap-1 px-4 sm:px-0 min-w-max">
          {SOCIETY_SECTIONS.map(s => {
            const active = isSectionActive(pathname, societyId, s.slug);
            const n = counts?.[s.slug || 'debates'] ?? 0;
            return (
              <Link key={s.label} href={societySectionHref(societyId, s.slug)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                  active ? 'border-blue-500 text-blue-300' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}>
                {s.label}
                {n > 0 && !active && <span className="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold leading-none text-blue-300">{n > 99 ? '99+' : n}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
      {right && <div className="hidden sm:block flex-shrink-0 pb-2.5">{right}</div>}
    </div>
  );
}
