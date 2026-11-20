'use client';

import { useState, useEffect, useRef } from 'react';
import UserMenu from './UserMenu';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { useAuth } from './AuthProvider';
import { NvLogo } from './NvLogo';
import { sectionsFor, societySectionHref, isSectionActive, societyRef } from './societies/SocietyTabs';
import { siteTitle } from '@/lib/sitePages';
import { groupPaths } from './dashboard/GroupTabs';

export const TOPICS = [
  { label: 'Culture, Identity & Social Issues', slug: 'culture' },
  { label: 'Economics & Markets',               slug: 'economics' },
  { label: 'Education & Knowledge',             slug: 'education' },
  { label: 'Environment & Energy',              slug: 'environment' },
  { label: 'Future & Existential Questions',    slug: 'future' },
  { label: 'Health, Medicine & Bioethics',      slug: 'health' },
  { label: 'History & Historical Interpretation', slug: 'history' },
  { label: 'Law, Rights & Justice',             slug: 'law' },
  { label: 'Media, Information & Epistemology', slug: 'media' },
  { label: 'Philosophy, Ethics & Religion',     slug: 'philosophy' },
  { label: 'Politics, Policy & Governance',     slug: 'politics' },
  { label: 'Science & Technology',              slug: 'science' },
];

type SocietyOption = { id: number; name: string; slug?: string | null; visibility?: string; isMember?: boolean; disabled?: string[] };
type SocietyList = { current: SocietyOption | null; public: SocietyOption[]; private: SocietyOption[] };

function NavLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600 select-none">
      {children}
    </p>
  );
}

function NavDivider() {
  return <div className="my-1 border-t border-blue-900/15" />;
}

// A menu section that collapses under its label. Open/closed is remembered per
// section on this device; collapsed sections still show a count badge.
function NavSection({ id, label, defaultOpen = false, badge, children }: {
  id: string; label: string; defaultOpen?: boolean; badge?: number; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    try {
      const v = localStorage.getItem(`dr_nav_${id}`);
      if (v === '1' || v === '0') setOpen(v === '1');
    } catch {}
  }, [id]);
  function toggle() {
    setOpen(o => {
      try { localStorage.setItem(`dr_nav_${id}`, o ? '0' : '1'); } catch {}
      return !o;
    });
  }
  return (
    <>
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600 hover:text-slate-400 select-none"
      >
        <span className="flex-1 text-left">{label}</span>
        {!open && !!badge && (
          <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-300 normal-case tracking-normal">{badge}</span>
        )}
        <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="space-y-0.5">{children}</div>}
    </>
  );
}

function NavLink({
  href,
  onClick,
  pathname,
  external,
  exact,
  children,
  icon,
  badge,
  badgeClassName,
  also,
}: {
  href: string;
  onClick: () => void;
  pathname: string;
  external?: boolean;
  exact?: boolean;
  children: React.ReactNode;
  icon: React.ReactNode;
  badge?: string;
  badgeClassName?: string;
  also?: string[];   // other pages this item stands for (its tabs)
}) {
  const isActive = !external && (pathname === href || (!exact && href !== '/' && pathname.startsWith(href))
    || !!also?.some(p => pathname.startsWith(p)));
  const cls = `flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors ${
    isActive ? 'bg-blue-500/15 text-blue-300 font-medium' : 'text-slate-300 hover:bg-blue-500/10 hover:text-blue-300'
  }`;
  const content = (
    <>
      <span className={`flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500'}`}>{icon}</span>
      <span className="flex-1">{children}</span>
      {badge && (
        <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${badgeClassName ?? 'bg-blue-500/20 text-blue-300'}`}>
          {badge}
        </span>
      )}
      {external && (
        <svg className="ml-auto h-3 w-3 text-slate-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
      )}
    </>
  );
  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={cls}>{content}</a>;
  }
  return <Link href={href} onClick={onClick} className={cls} data-active={isActive ? 'true' : undefined}>{content}</Link>;
}

// One Society in the menu. Its name opens the Society; the chevron shows its
// sections (Debate, Discussions, Documents, …). Societies the visitor
// can't enter yet (Apply, not a member) have no sections, just the teaser.
function SocietyNavItem({ society, isCurrent, defaultOpen, switching, onEnter, onNavigate, pathname, icon, counts }: {
  society: SocietyOption; isCurrent: boolean; defaultOpen: boolean; switching: boolean;
  onEnter: (id: number) => void; onNavigate: () => void; pathname: string; icon: React.ReactNode;
  counts?: Record<string, number>;   // new items per section since last looked
}) {
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const canEnter = society.visibility === 'public' || !!society.isMember;
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    try {
      const v = localStorage.getItem(`dr_nav_soc_${society.id}`);
      setOpen(v === '1' ? true : v === '0' ? false : defaultOpen);
    } catch { setOpen(defaultOpen); }
  }, [society.id, defaultOpen]);
  function toggle() {
    setOpen(o => {
      try { localStorage.setItem(`dr_nav_soc_${society.id}`, o ? '0' : '1'); } catch {}
      return !o;
    });
  }
  return (
    <div>
      <div className={`flex items-center rounded-lg transition-colors ${isCurrent ? 'bg-blue-500/15' : 'hover:bg-blue-500/10'}`}>
        <button
          onClick={() => onEnter(society.id)}
          disabled={switching}
          className={`flex flex-1 min-w-0 items-center gap-3 px-3 py-1.5 text-sm text-left ${isCurrent ? 'text-blue-300 font-medium' : 'text-slate-300 hover:text-blue-300'}`}
        >
          <span className={`flex-shrink-0 ${isCurrent ? 'text-blue-400' : 'text-slate-500'}`}>{icon}</span>
          <span className="flex-1 truncate">{society.name}</span>
          {!canEnter && <span className="rounded border border-slate-600 px-1 text-[10px] text-slate-400">Apply</span>}
          {total > 0 && !open && <span className="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold leading-none text-blue-300">{total > 99 ? '99+' : total}</span>}
          {switching && <span className="text-slate-600">…</span>}
        </button>
        {canEnter && (
          <button onClick={toggle} aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} ${society.name} sections`}
            className="px-2 py-1.5 text-slate-500 hover:text-slate-300">
            <svg className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
      {canEnter && open && (
        <div className="ml-5 mt-0.5 mb-1 space-y-0.5 border-l border-blue-900/20 pl-3">
          {sectionsFor(society.disabled).map(sec => {
            const ref = societyRef(society.id, society.slug);
            const href = societySectionHref(ref, sec.slug);
            const active = isSectionActive(pathname, ref, sec.slug);
            const n = counts?.[sec.slug || 'debates'] ?? 0;
            return (
              <Link key={sec.label} href={href} onClick={onNavigate}
                className={`flex items-center justify-between rounded px-2 py-1 text-xs transition-colors ${active ? 'bg-blue-500/15 text-blue-300' : 'text-slate-400 hover:bg-blue-500/10 hover:text-blue-300'}`}>
                {sec.label}
                {n > 0 && !active && <span className="rounded-full bg-blue-500/20 px-1.5 text-[10px] font-bold text-blue-300">{n > 99 ? '99+' : n}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const icons = {
  dashboard: <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6" /></svg>,
  debate:    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8M8 13h5m-9 7 4-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3l-4 4Z" /></svg>,
  laws:      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.97Z" /></svg>,
  proposals: <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>,
  principles:<svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>,
  poll:      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>,
  elect:     <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
  task:      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" /></svg>,
  ai:        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>,
  alerts:    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>,
  newdebate: <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
  forums:    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>,
  debates_manage: <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" /></svg>,
  profile:   <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>,
  settings:  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>,
  help:      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>,
  news:      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" /></svg>,
  contact:   <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>,
  topics:    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>,
  login:     <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" /></svg>,
  signup:    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" /></svg>,
  logout:    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" /></svg>,
  statements:<svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>,
  quality:   <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" /></svg>,
  key:       <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" /></svg>,
  home:      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>,
};

export default function Header() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const pageTitle = siteTitle(pathname);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [topicsOpen,    setTopicsOpen]    = useState(false);
  const [modCounts,     setModCounts]     = useState({ myPending: 0, joinsPending: 0, ownPending: 0, invitesAnswered: 0, contentNews: 0 });
  const [moderates,     setModerates]     = useState(0);   // Societies this user moderates
  const [unread,        setUnread]        = useState<Record<string, Record<string, number>>>({});
  const [viewedSociety, setViewedSociety] = useState<number | null>(null);
  const [societies,     setSocieties]     = useState<SocietyList | null>(null);
  const [switching,     setSwitching]     = useState<number | null>(null);
  const [guestKey,      setGuestKey]      = useState<{ label: string } | null>(null);
  const [guestWelcome,  setGuestWelcome]  = useState<{ id: string; label: string; debateCount: number } | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const navRef    = useRef<HTMLElement>(null);

  const isHomePage = pathname === '/';

  // Role sections are cumulative: Moderator ⊃ Debater ⊃ Voter. SysAdmin is a
  // separate, system-only role (a person can be both, as tiers are independent).
  const tier = user?.tier;
  const isModerator = tier === 'moderator' || moderates > 0;
  const isDebater   = isModerator || tier === 'debater';
  const isVoter     = isDebater || tier === 'voter';
  // Alerts & Flags: your own content awaiting review, plus (moderators) the review queue.
  // Users: join requests to decide, and answers to your invitations not yet seen.
  const alertBadge  = modCounts.ownPending + (isModerator ? modCounts.myPending : 0);
  const userBadge   = isModerator ? modCounts.joinsPending + modCounts.invitesAnswered : 0;
  const modBadge    = alertBadge + userBadge + modCounts.contentNews;
  const warnBadge   = theme === 'dark' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/15 text-red-600';

  // Scroll active nav item into view when drawer opens
  useEffect(() => {
    if (!menuOpen || !navRef.current) return;
    const active = navRef.current.querySelector('[data-active="true"]') as HTMLElement | null;
    if (active) active.scrollIntoView({ block: 'nearest' });
  }, [menuOpen]);

  // Close drawer on outside click / Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    const onClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) {
      document.addEventListener('keydown', onKey);
      document.addEventListener('mousedown', onClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [menuOpen]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  // New items per Society section (menu badges); refreshed on navigation and
  // whenever a Society page records a visit
  useEffect(() => {
    if (!user) { setUnread({}); return; }
    const load = () => fetch('/api/me/unread').then(r => r.ok ? r.json() : null).then(d => d && setUnread(d.societies ?? {})).catch(() => {});
    load();
    window.addEventListener('dr:unread-changed', load);
    return () => window.removeEventListener('dr:unread-changed', load);
  }, [user, pathname]);

  // The Society being viewed, so its name heads the page
  useEffect(() => {
    const m = pathname.match(/^\/society\/([^/]+)/);
    const q = pathname === '/scotparl' ? new URLSearchParams(window.location.search).get('society') : null;
    if (m && !/^\d+$/.test(m[1])) {
      const named = societies ? [...societies.public, ...societies.private].find(x => x.slug === decodeURIComponent(m[1])) : undefined;
      setViewedSociety(named?.id ?? null);
    } else setViewedSociety(m ? Number(m[1]) : q ? Number(q) : null);
  }, [pathname, societies]);

  // Societies this user moderates (moderating one makes them a Moderator)
  useEffect(() => {
    if (!user) { setModerates(0); return; }
    fetch('/api/me/roles')
      .then(r => r.ok ? r.json() : null)
      .then(d => setModerates(d?.moderatedSocieties?.length ?? 0))
      .catch(() => {});
  }, [user]);

  // Alert / join-request counts for the Moderator section badges
  useEffect(() => {
    if (!user) return;
    const load = () => {
      const q = new URLSearchParams();
      try {
        const inv = localStorage.getItem('dr_invites_seen'), con = localStorage.getItem('dr_content_seen');
        if (inv) q.set('invitesSince', inv);
        if (con) q.set('contentSince', con);
      } catch {}
      return fetch(`/api/alerts/counts?${q}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d) setModCounts({ myPending: d.myPending ?? 0, joinsPending: d.joinsPending ?? 0, ownPending: d.ownPending ?? 0, invitesAnswered: d.invitesAnswered ?? 0, contentNews: d.contentNews ?? 0 });
        })
        .catch(() => {});
    };
    void load();
    window.addEventListener('dr:alerts-changed', load);
    return () => window.removeEventListener('dr:alerts-changed', load);
  }, [user]);

  // Fetch the current society + which public/private ones this visitor can
  // switch to. Re-fetched when auth state changes since the private list
  // depends on who's logged in.
  useEffect(() => {
    fetch('/api/customer/current')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSocieties(d); })
      .catch(() => {});
  }, [user]);

  async function switchSociety(id: number) {
    if (switching) return;
    setSwitching(id);
    try {
      const r = await fetch('/api/customer/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: id }),
      });
      // A Society's name opens its About page; its sections are under the chevron
      const named = societies ? [...societies.public, ...societies.private].find(x => x.id === id) : undefined;
      if (r.ok) window.location.href = `/society/${societyRef(id, named?.slug)}/about`;
    } finally {
      setSwitching(null);
    }
  }

  // Access Key guest (no account): show a "Guest access" chip with an End button.
  useEffect(() => {
    if (user) { setGuestKey(null); return; }
    fetch('/api/access-key')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setGuestKey(d ? { label: d.label } : null);
        // First visit with this key on this device: show the welcome message once
        if (d) {
          let seen = false;
          try { seen = localStorage.getItem('dr_key_welcomed') === d.id; } catch {}
          if (!seen) setGuestWelcome({ id: d.id, label: d.label, debateCount: d.debates?.length ?? 1 });
        }
      })
      .catch(() => {});
  }, [user, pathname]);

  function closeGuestWelcome() {
    if (guestWelcome) {
      try { localStorage.setItem('dr_key_welcomed', guestWelcome.id); } catch {}
    }
    setGuestWelcome(null);
  }

  async function endGuestAccess() {
    await fetch('/api/access-key', { method: 'DELETE' });
    window.location.href = '/';
  }

  // Pinned: on sm+ screens the drawer stays docked open below the header and
  // the page shifts right (CSS keys off <html data-menu-pinned>, which the
  // inline script in app/layout.tsx restores before hydration).
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    try { setPinned(localStorage.getItem('dr_menu_pinned') === '1'); } catch {}
  }, []);
  function setPin(on: boolean) {
    setPinned(on);
    setMenuOpen(false);
    document.documentElement.toggleAttribute('data-menu-pinned', on);
    try { localStorage.setItem('dr_menu_pinned', on ? '1' : '0'); } catch {}
  }
  function openMenu() {
    // Hamburger on a pinned desktop menu collapses it; otherwise opens the drawer.
    if (pinned && window.matchMedia('(min-width: 640px)').matches) setPin(false);
    else setMenuOpen(true);
  }

  function close() { setMenuOpen(false); }

  return (
    <>
      {/* ── Fixed top bar ─────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-blue-900/20 bg-[#080d1a]/90 backdrop-blur-md">
        <div className="relative flex h-16 w-full items-center justify-between px-4 sm:px-8">

          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={openMenu}
              aria-label={pinned ? 'Collapse navigation menu' : 'Open navigation menu'}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* On home: mobile-only logo; on inner pages: always show logo */}
            <Link href="/" className={`${isHomePage ? 'sm:hidden' : ''} flex items-center gap-2 select-none`}>
              <NvLogo className="w-7 h-7" />
              {/* On phones a Society's name takes the middle, so keep just the logo */}
              <span className={`${viewedSociety || pageTitle ? 'hidden sm:inline' : ''} text-base font-bold tracking-tight text-slate-100`}>
                new<span className="text-blue-400">.vote</span>
              </span>
            </Link>
          </div>

          {/* Centre: home page → big logo; inner pages → customer name */}
          {isHomePage ? (
            <Link href="/" className="hidden sm:flex absolute left-1/2 -translate-x-1/2 items-center gap-2 select-none">
              <NvLogo className="w-8 h-8" />
              <span className="text-lg font-bold tracking-tight text-slate-100">
                new<span className="text-blue-400">.vote</span>
              </span>
            </Link>
          ) : pageTitle ? (
            <span className="absolute left-1/2 -translate-x-1/2 max-w-[46%] sm:max-w-[50%] truncate text-center text-base sm:text-2xl font-bold text-slate-100">
              {pageTitle}
            </span>
          ) : (() => {
            // On a Society's pages its name is the page title; elsewhere, the current Society
            const all = societies ? [...societies.public, ...societies.private] : [];
            const viewed = viewedSociety ? all.find(x => x.id === viewedSociety) : null;
            const title = viewed?.name ?? societies?.current?.name;
            const titleId = viewed?.id ?? societies?.current?.id;
            const titleRef = societyRef(titleId ?? 0, (viewed ?? all.find(x => x.id === titleId))?.slug);
            if (!title || !titleId) return null;
            // The title links to the Society's About page
            return viewed ? (
              <Link href={`/society/${titleRef}/about`} title={`About ${title}`}
                className="absolute left-1/2 -translate-x-1/2 max-w-[46%] sm:max-w-[50%] truncate text-center text-base sm:text-2xl font-bold text-slate-100 hover:text-white">
                {title}
              </Link>
            ) : (
              <Link href={`/society/${titleRef}/about`} title={`About ${title}`}
                className="hidden sm:block absolute left-1/2 -translate-x-1/2 text-base font-semibold text-slate-200 hover:text-white truncate max-w-[40%] text-center">
                {title}
              </Link>
            );
          })()}

          {/* Right: theme toggle + auth */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label="Toggle colour theme"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
            >
              {theme === 'dark' ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 1 0 0 14A7 7 0 0 0 12 5Z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
                </svg>
              )}
            </button>

            {user ? (
              <UserMenu handle={user.handle} isSysAdmin={!!user.isSysAdmin} onLogout={logout} />
            ) : guestKey ? (
              <div className="flex items-center gap-2">
                <span
                  title={`Viewing with an access key: ${guestKey.label}`}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
                  </svg>
                  Guest access
                </span>
                <button onClick={endGuestAccess} className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors px-1.5 py-1.5">
                  End
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 ring-1 ring-transparent transition-all duration-200 hover:bg-blue-500/10 hover:text-blue-200 hover:ring-blue-500/30">Log in</Link>
                <Link href="/register" className="hidden sm:inline-block rounded-lg border border-blue-700/40 px-3 py-1.5 text-sm font-medium text-blue-400 transition-colors hover:border-blue-500/70 hover:bg-blue-500/10">Sign up</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Backdrop ──────────────────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-hidden="true"
      />

      {/* ── Mobile bottom tab bar ────────────────────────────────────────────── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-blue-900/20 bg-[#080d1a]/95 backdrop-blur-md">
        {[
          { href: '/chamber',            label: 'Debates',   icon: icons.debate },
          ...(user?.isSysAdmin ? [
            { href: '/scotparl/proposals', label: 'Proposals', icon: icons.proposals },
            { href: '/scotparl/bills',     label: 'Laws',      icon: icons.laws },
            { href: '/scotparl/principles',label: 'Principles',icon: icons.principles },
          ] : []),
        ].map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${active ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <span className={active ? 'text-blue-400' : 'text-slate-500'}>{icon}</span>
              {label}
            </Link>
          );
        })}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium text-slate-500 hover:text-slate-300 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          More
        </button>
      </nav>

      {/* ── Slide-in nav drawer ───────────────────────────────────────────────── */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`nav-drawer fixed top-0 left-0 z-50 h-full w-72 bg-dr-card border-r border-blue-900/20 flex flex-col transform transition-transform duration-300 ease-in-out ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Drawer header (hidden when pinned — the page header is visible above) */}
        <div className="nav-drawer-head flex h-16 items-center justify-between px-5 border-b border-blue-900/15 flex-shrink-0">
          <Link href="/" onClick={close} className="flex items-center gap-2">
            <NvLogo className="w-7 h-7" />
            <span className="font-bold text-slate-100">new<span className="text-blue-400">.vote</span></span>
          </Link>
          <button onClick={close} aria-label="Close menu" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav ref={navRef} className="flex-1 overflow-y-auto py-2 px-3 space-y-0.5">

          {/* ── HOME / DASHBOARD ── */}
          <NavLink href="/" onClick={close} pathname={pathname} icon={icons.home}>
            Home
          </NavLink>

          <NavDivider />

          {/* ── PUBLIC / PRIVATE SOCIETIES — public first. Sections open by
               default when the visitor belongs to exactly one Society. ── */}
          {societies && (() => {
            const all = [...societies.public, ...societies.private];
            const associated = all.filter(x => x.isMember).length;
            const item = (x: SocietyOption, icon: React.ReactNode) => (
              <SocietyNavItem
                key={x.id}
                society={x}
                isCurrent={viewedSociety === x.id}
                defaultOpen={associated === 1 && !!x.isMember}
                switching={switching === x.id}
                onEnter={id => { close(); switchSociety(id); }}
                onNavigate={close}
                pathname={pathname}
                icon={icon}
                counts={unread[String(x.id)]}
              />
            );
            // Collapsed, a list's badge totals what's new across its Societies
            const fresh = (list: SocietyOption[]) => list.reduce((n, x) =>
              n + Object.values(unread[String(x.id)] ?? {}).reduce((a, b) => a + b, 0), 0);
            return (
              <>
                {societies.public.length > 0 && (
                  <NavSection id="public_societies" label={`Public Societies (${societies.public.length})`} defaultOpen badge={fresh(societies.public)}>
                    {societies.public.map(x => item(x, icons.forums))}
                  </NavSection>
                )}
                {societies.private.length > 0 && (
                  <NavSection id="private_societies" label={`Private Societies (${societies.private.length})`} defaultOpen badge={fresh(societies.private)}>
                    {societies.private.map(x => item(x, icons.settings))}
                  </NavSection>
                )}
              </>
            );
          })()}

          {/* ── DEBATE: browse debates by topic (collapsible) ── */}
          <NavLabel>Debate</NavLabel>
          <button
            onClick={() => setTopicsOpen(o => !o)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-blue-500/10 hover:text-slate-300"
          >
            <span className="flex items-center gap-3">
              <span className="text-slate-600">{icons.topics}</span>
              Debate Topics
            </span>
            <svg className={`h-4 w-4 text-slate-600 transition-transform ${topicsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
            </svg>
          </button>

          {topicsOpen && (
            <div className="ml-3 mt-1 space-y-0.5 border-l border-blue-900/20 pl-3">
              {TOPICS.map(t => (
                <Link
                  key={t.slug}
                  href={`/chamber?subject=${t.slug}`}
                  onClick={close}
                  className="block rounded px-2 py-1.5 text-xs text-slate-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
                >
                  {t.label}
                </Link>
              ))}
            </div>
          )}

          <NavDivider />

          {/* ── VOTER / DEBATER / MODERATOR (cumulative, by tier) ── */}
          {user && isVoter && (
            <>
              <NavSection
                id="role"
                label={isModerator ? 'Moderator' : isDebater ? 'Debater' : 'Voter'}
                badge={modBadge}
              >
                <NavLink href="/my-content" onClick={close} pathname={pathname} icon={icons.statements}
                  badge={modCounts.contentNews > 0 ? String(modCounts.contentNews) : undefined}>
                  My Content
                </NavLink>
                <NavLink
                  href="/dashboard/alerts" also={groupPaths('Alerts & Flags')} onClick={close} pathname={pathname} icon={icons.alerts}
                  badge={alertBadge > 0 ? String(alertBadge) : undefined} badgeClassName={warnBadge}
                >
                  Alerts &amp; Flags
                </NavLink>
                {isModerator && (
                  <>
                    {/* Moderator accounts' Dashboard (Sys Admin finds it under Admin) */}
                    {user?.tier === 'moderator' && !user.isSysAdmin && (
                      <NavLink href="/scotparl" onClick={close} pathname={pathname} icon={icons.dashboard} exact>
                        Dashboard
                      </NavLink>
                    )}
                    <NavLink href="/dashboard/societies" onClick={close} pathname={pathname} icon={icons.forums}>
                      Societies
                    </NavLink>
                    <NavLink href="/dashboard/debates" also={groupPaths('Debates')} onClick={close} pathname={pathname} icon={icons.debates_manage}>
                      Debates
                    </NavLink>
                    <NavLink
                      href="/dashboard/join-requests" also={groupPaths('Users')} onClick={close} pathname={pathname} icon={icons.signup}
                      badge={userBadge > 0 ? String(userBadge) : undefined} badgeClassName={warnBadge}
                    >
                      Users
                    </NavLink>
                  </>
                )}
              </NavSection>
              <NavDivider />
            </>
          )}

          {/* ── SYSADMIN: system features only ── */}
          {user?.isSysAdmin && (
            <>
              <NavSection id="admin" label="Admin">
                <NavLink href="/admin" onClick={close} pathname={pathname} icon={icons.settings} exact>
                  Settings (Site)
                </NavLink>
                <NavLink href="/admin/newsletter" onClick={close} pathname={pathname} icon={icons.news}>
                  Newsletter (Admin)
                </NavLink>
              </NavSection>
              <NavDivider />
            </>
          )}

          {/* ── ACCOUNT (always open) ── */}
          <NavLabel>Account</NavLabel>
          {user ? (
            <>
              <NavLink href="/profile" onClick={close} pathname={pathname} icon={icons.profile}>
                Profile &amp; Billing
              </NavLink>
              <button
                onClick={() => { logout(); close(); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <span className="text-slate-600">{icons.logout}</span>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink href="/pricing" onClick={close} pathname={pathname} icon={icons.signup}>
                Sign up / Pricing
              </NavLink>
              <NavLink href="/login" onClick={close} pathname={pathname} icon={icons.login}>
                Log in
              </NavLink>
            </>
          )}

          <NavDivider />

          {/* ── HELP ── */}
          <NavLabel>Help</NavLabel>
          <NavLink href="https://debate.support" onClick={close} pathname={pathname} icon={icons.help} external>
            Debating Guide
          </NavLink>
          <NavLink href="/blog" onClick={close} pathname={pathname} icon={icons.news}>
            Newsletter
          </NavLink>
          <NavLink href="/contact" onClick={close} pathname={pathname} icon={icons.contact}>
            Contact Us
          </NavLink>

        </nav>

        {/* Pin / unpin (desktop only) */}
        <div className="hidden sm:block flex-shrink-0 border-t border-blue-900/15 px-3 py-2">
          <button
            onClick={() => setPin(!pinned)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-blue-500/10 hover:text-slate-300"
          >
            <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              {pinned ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5 11.25 12l7.5-7.5m-6 15L5.25 12l7.5-7.5" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z" />
              )}
            </svg>
            {pinned ? 'Unpin menu' : 'Pin menu open'}
          </button>
        </div>
      </div>

      {/* ── Access Key welcome (first visit on this device) ───────────────────── */}
      {guestWelcome && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closeGuestWelcome}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-welcome-title"
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-dr-surface p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 id="guest-welcome-title" className="text-lg font-semibold text-white">
              Welcome {guestWelcome.label}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300">
              <p>
                You have been invited to review {guestWelcome.debateCount > 1 ? 'these private debates' : 'this private debate'}.
              </p>
              <p>
                I will be delighted to receive any feedback from you, either via the{' '}
                <Link href="/contact" onClick={closeGuestWelcome} className="text-blue-400 hover:underline">Contact Us</Link>{' '}
                page on this site, or directly to me via the email I sent you.
              </p>
              <p>Thank you very much for your time.</p>
              <p className="font-medium text-slate-200">David Twaddell</p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                autoFocus
                onClick={closeGuestWelcome}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
              >
                View the debate{guestWelcome.debateCount > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
