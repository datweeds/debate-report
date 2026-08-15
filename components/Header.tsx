'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { useAuth } from './AuthProvider';
import { DrLogo } from './DrLogo';

const SUBJECT_AREAS = [
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

type DashItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  modOnly?: boolean;
  countKey?: 'myPending' | 'scannerPending' | 'joinsPending' | 'invitesPending';
};

const DASH_ITEMS: DashItem[] = [
  {
    href: '/dashboard/alerts',
    label: 'Alerts',
    countKey: 'myPending',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
      </svg>
    ),
  },
  {
    href: '/dashboard/scanner',
    label: 'Scanner',
    modOnly: true,
    countKey: 'scannerPending',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/your-votes',
    label: 'Your Votes',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/chat-comments',
    label: 'Chat Comments',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/invitations',
    label: 'Invitations',
    modOnly: true,
    countKey: 'invitesPending' as const,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    href: '/dashboard/join-requests',
    label: 'Join Requests',
    modOnly: true,
    countKey: 'joinsPending' as const,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/new-debate',
    label: 'Start a Debate',
    modOnly: true,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/debates',
    label: 'Your Debates',
    modOnly: true,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/forums',
    label: 'Debate Forums',
    modOnly: true,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/billing',
    label: 'Billing',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    ),
  },
];

type Counts = { myPending: number; scannerPending: number; joinsPending: number; invitesPending: number };

export default function Header() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [subjectsOpen,  setSubjectsOpen]  = useState(false);
  const [dashOpen,      setDashOpen]      = useState(false);
  const [counts,        setCounts]        = useState<Counts>({ myPending: 0, scannerPending: 0, joinsPending: 0, invitesPending: 0 });
  const [chamberHref,   setChamberHref]   = useState('/chamber');
  const drawerRef = useRef<HTMLDivElement>(null);

  const isMod = user?.tier === 'moderator' || user?.isSysAdmin;
  const totalBadge = counts.myPending + counts.scannerPending + counts.joinsPending + counts.invitesPending;
  const isDashActive = pathname.startsWith('/dashboard');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('keydown', onKey);
      document.addEventListener('mousedown', onClick);
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [menuOpen]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  // Open dashboard section automatically when on a dashboard page
  useEffect(() => {
    if (isDashActive) setDashOpen(true);
  }, [isDashActive]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/alerts/counts')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setCounts({ myPending: d.myPending ?? 0, scannerPending: d.scannerPending ?? 0, joinsPending: d.joinsPending ?? 0, invitesPending: d.invitesPending ?? 0 });
        const dbId: string | null = d.lastResolutionId ?? null;
        try {
          const localId = localStorage.getItem('dr_last_resolution');
          const id = localId ?? dbId;
          if (id) setChamberHref(`/chamber?resolution=${id}`);
        } catch {
          if (dbId) setChamberHref(`/chamber?resolution=${dbId}`);
        }
      })
      .catch(() => {/* silent */});
  }, [user]);

  const visibleDashItems = DASH_ITEMS.filter(item => {
    if (!user) return false;
    if (item.modOnly) return isMod;
    return true;
  });

  function close() { setMenuOpen(false); }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-blue-900/20 bg-[#080d1a]/90 backdrop-blur-md">
        <div className="relative flex h-16 w-full items-center justify-between px-4 sm:px-8">

          {/* Left: hamburger (+ logo on mobile) */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation menu"
              className="header-theme-toggle flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* Mobile-only logo — inline with hamburger */}
            <Link href="/" className="sm:hidden flex items-center gap-2 select-none">
              <DrLogo className="w-7 h-7" />
              <span className="dr-wordmark text-lg font-bold tracking-tight text-slate-100">
                debate<span className="text-gradient-blue">.report</span>
              </span>
            </Link>
          </div>

          {/* Desktop-only logo — absolutely centred */}
          <Link href="/" className="hidden sm:flex absolute left-1/2 -translate-x-1/2 items-center gap-2 select-none">
            <DrLogo className="w-8 h-8" />
            <span className="dr-wordmark text-lg font-bold tracking-tight text-slate-100">
              debate<span className="text-gradient-blue">.report</span>
            </span>
          </Link>

          {/* Right: theme toggle + auth */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label="Toggle colour theme"
              className="header-theme-toggle flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
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
              <div className="flex items-center gap-1">
                <Link
                  href="/profile"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/10"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12Zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8Z" />
                  </svg>
                  <span className="hidden sm:inline">{user.handle}</span>
                  {user.isSysAdmin && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold text-amber-400 leading-none">
                      sys
                    </span>
                  )}
                </Link>
                {user.isSysAdmin && (
                  <Link href="/admin" className="rounded px-2 py-1 text-xs text-amber-400 hover:bg-amber-500/10 transition-colors">
                    Admin
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="rounded px-2 py-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors px-2 py-1.5">
                  Login
                </Link>
                <Link href="/pricing" className="rounded-lg border border-blue-700/40 px-3 py-1.5 text-sm font-medium text-blue-400 transition-colors hover:border-blue-500/70 hover:bg-blue-500/10">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-hidden="true"
      />

      {/* Slide-in nav drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`nav-drawer fixed top-0 left-0 z-50 h-full w-72 bg-dr-card border-r border-blue-900/20 flex flex-col transform transition-transform duration-300 ease-in-out ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-blue-900/15">
          <Link href="/" onClick={close} className="flex items-center gap-2">
            <DrLogo className="w-7 h-7" />
            <span className="dr-wordmark font-bold text-slate-100">debate<span className="text-gradient-blue">.report</span></span>
          </Link>
          <button
            onClick={close}
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">

          {/* ── Debate Chamber (always first) */}
          <Link
            href={user ? chamberHref : '/chamber'}
            onClick={close}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              pathname === '/chamber' || pathname.startsWith('/chamber?')
                ? 'bg-blue-500/15 text-blue-300 font-medium'
                : 'text-slate-300 hover:bg-blue-500/10 hover:text-blue-300'
            }`}
          >
            <svg className="h-4 w-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8M8 13h5m-9 7 4-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3l-4 4Z" />
            </svg>
            Debate Chamber
          </Link>

          {/* ── Proposals */}
          <Link
            href="/scotparl/proposals"
            onClick={close}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              pathname.startsWith('/scotparl')
                ? 'bg-blue-500/15 text-blue-300 font-medium'
                : 'text-slate-300 hover:bg-blue-500/10 hover:text-blue-300'
            }`}
          >
            <svg className="h-4 w-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
            Proposals
          </Link>

          {/* ── Dashboard (logged-in users) */}
          {user && visibleDashItems.length > 0 && (
            <>
              <button
                onClick={() => setDashOpen(o => !o)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isDashActive
                    ? 'bg-blue-500/15 text-blue-300 font-medium'
                    : 'text-slate-300 hover:bg-blue-500/10 hover:text-slate-200'
                }`}
              >
                <svg className="h-4 w-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6" />
                </svg>
                <span className="flex-1 text-left">
                  Dashboard{totalBadge > 0 ? ` (${totalBadge})` : ''}
                </span>
                <svg
                  className={`h-4 w-4 text-slate-500 flex-shrink-0 transition-transform ${dashOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                </svg>
              </button>

              {dashOpen && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-blue-900/20 pl-3">
                  {visibleDashItems.map(item => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    const count = item.countKey ? counts[item.countKey] : 0;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={close}
                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                          isActive
                            ? 'bg-blue-500/15 text-blue-300'
                            : 'text-slate-400 hover:bg-blue-500/10 hover:text-slate-200'
                        }`}
                      >
                        <span className={isActive ? 'text-blue-400' : 'text-slate-600'}>
                          {item.icon}
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {count > 0 && (
                          <span className="ml-auto rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300 leading-none">
                            {count}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <div className="my-1 border-t border-blue-900/15" />

          {/* ── Auth items */}
          {!user && (
            <>
              <Link href="/pricing" onClick={close} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-blue-500/10 hover:text-blue-300">
                <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Sign up / Pricing
              </Link>
              <Link href="/login" onClick={close} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-blue-500/10 hover:text-blue-300">
                <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                </svg>
                Log in
              </Link>
            </>
          )}

          {user && (
            <Link href="/profile" onClick={close} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-blue-500/10 hover:text-blue-300">
              <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              My Profile
            </Link>
          )}

          <a
            href="https://debate.support"
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
          >
            <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
            Debating Guide
            <svg className="ml-auto h-3 w-3 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>

          <div className="my-1 border-t border-blue-900/15" />

          {/* ── Debate Topics collapsible */}
          <button
            onClick={() => setSubjectsOpen(o => !o)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-blue-500/10 hover:text-slate-300"
          >
            <span className="flex items-center gap-3">
              <svg className="h-4 w-4 text-blue-400/70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
              </svg>
              Debate Topics
            </span>
            <svg
              className={`h-4 w-4 transition-transform ${subjectsOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
            </svg>
          </button>

          {subjectsOpen && (
            <div className="ml-3 mt-1 space-y-0.5 border-l border-blue-900/20 pl-3">
              {SUBJECT_AREAS.map(s => (
                <Link
                  key={s.slug}
                  href={`/chamber?subject=${s.slug}`}
                  onClick={close}
                  className="block rounded px-2 py-1.5 text-xs text-slate-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
                >
                  {s.label}
                </Link>
              ))}
            </div>
          )}
        </nav>
      </div>
    </>
  );
}
