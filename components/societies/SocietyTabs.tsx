'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const SOCIETY_SECTIONS = [
  { slug: 'discussions', label: 'Discussions' },
  { slug: 'events',      label: 'Events' },
  { slug: 'documents',   label: 'Documents' },
  { slug: 'polls',       label: 'Polls' },
  { slug: '',            label: 'Debate' },
  { slug: 'projects',    label: 'Projects' },
  { slug: 'news',        label: 'News' },
  { slug: 'meet',        label: 'Meet' },
  { slug: 'tasks',       label: 'Tasks' },
  { slug: 'principles',  label: 'Principles' },
  { slug: 'about',       label: 'About' },
] as const;

/** A Society's address: its name when it has one, else its number. */
export const societyRef = (societyId: number, name?: string | null) => name || String(societyId);

export function societySectionHref(ref: number | string, slug: string) {
  return slug ? `/society/${ref}/${slug}` : `/society/${ref}`;
}

export function isSectionActive(pathname: string, ref: number | string, slug: string) {
  return slug ? pathname.startsWith(`/society/${ref}/${slug}`) : pathname === `/society/${ref}`;
}

// Tab bar across a Society's sections; scrolls sideways on small screens.
// `counts` shows new items per section since the viewer last looked.
/** A section's feature key ('' is Debate); About can't be switched off. */
export const sectionKey = (slug: string) => slug || 'debates';
export const sectionsFor = (disabled?: string[]) => SOCIETY_SECTIONS.filter(s => !disabled?.includes(sectionKey(s.slug)));

export default function SocietyTabs({ societyId, slug, counts, right, disabled }: {
  societyId: number; slug?: string | null; counts?: Record<string, number>; right?: React.ReactNode; disabled?: string[];
}) {
  const ref = societyRef(societyId, slug);
  const pathname = usePathname();
  return (
    <div className="flex items-end gap-3 border-b border-slate-800">
      <nav className="-mx-4 sm:mx-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-1 px-4 sm:px-0 min-w-max">
          {sectionsFor(disabled).map(s => {
            const active = isSectionActive(pathname, ref, s.slug);
            const n = counts?.[s.slug || 'debates'] ?? 0;
            return (
              <Link key={s.label} href={societySectionHref(ref, s.slug)}
                className={`group relative flex items-center gap-1.5 rounded-t-md px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors duration-200 ${
                  active ? 'border-blue-500 text-blue-300' : 'border-transparent text-slate-400 hover:bg-blue-500/[0.06] hover:text-slate-100'
                }`}>
                {!active && <span aria-hidden className="pointer-events-none absolute inset-x-3 bottom-0 h-0.5 origin-center scale-x-0 rounded-full bg-blue-400/70 transition-transform duration-200 group-hover:scale-x-100" />}
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
