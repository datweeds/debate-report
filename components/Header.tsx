'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { useAuth } from './AuthProvider';
import { NvLogo } from './NvLogo';

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

type AdminRole = { isCustomerAdmin: boolean; isTopicOwner: boolean; isScotparlMod: boolean };

function NavLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600 select-none">
      {children}
    </p>
  );
}

function NavDivider() {
  return <div className="my-1 border-t border-blue-900/15" />;
}

function NavLink({
  href,
  onClick,
  pathname,
  external,
  children,
  icon,
  badge,
}: {
  href: string;
  onClick: () => void;
  pathname: string;
  external?: boolean;
  children: React.ReactNode;
  icon: React.ReactNode;
  badge?: string;
}) {
  const isActive = !external && (pathname === href || (href !== '/' && pathname.startsWith(href)));
  const cls = `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
    isActive ? 'bg-blue-500/15 text-blue-300 font-medium' : 'text-slate-300 hover:bg-blue-500/10 hover:text-blue-300'
  }`;
  const content = (
    <>
      <span className={`flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500'}`}>{icon}</span>
      <span className="flex-1">{children}</span>
      {badge && (
        <span className="ml-auto rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300 leading-none">
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
  return <Link href={href} onClick={onClick} className={cls}>{content}</Link>;
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
  profile:   <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>,
  settings:  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>,
  help:      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>,
  contact:   <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>,
  topics:    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>,
  login:     <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" /></svg>,
  signup:    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" /></svg>,
  logout:    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" /></svg>,
};

export default function Header() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [topicsOpen,    setTopicsOpen]    = useState(false);
  const [chamberHref,   setChamberHref]   = useState('/chamber');
  const [adminRole,     setAdminRole]     = useState<AdminRole | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const isMod = user?.tier === 'moderator' || user?.isSysAdmin;

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

  // Fetch chamber last-viewed + alert counts
  useEffect(() => {
    if (!user) return;
    fetch('/api/alerts/counts')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        const dbId: string | null = d.lastResolutionId ?? null;
        try {
          const localId = localStorage.getItem('dr_last_resolution');
          const id = localId ?? dbId;
          if (id) setChamberHref(`/chamber?resolution=${id}`);
        } catch {
          if (dbId) setChamberHref(`/chamber?resolution=${dbId}`);
        }
      })
      .catch(() => {});
  }, [user]);

  // Fetch scotparl admin roles for conditional menu items
  useEffect(() => {
    if (!user) { setAdminRole(null); return; }
    fetch('/api/scotparl/admin/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) setAdminRole({ isCustomerAdmin: !!d.isCustomerAdmin, isTopicOwner: !!d.isTopicOwner, isScotparlMod: !!d.isScotparlMod });
      })
      .catch(() => {});
  }, [user]);

  function close() { setMenuOpen(false); }

  const canManage = adminRole?.isCustomerAdmin || adminRole?.isTopicOwner || user?.isSysAdmin;

  return (
    <>
      {/* ── Fixed top bar ─────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-blue-900/20 bg-[#080d1a]/90 backdrop-blur-md">
        <div className="relative flex h-16 w-full items-center justify-between px-4 sm:px-8">

          {/* Left: hamburger + mobile logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/" className="sm:hidden flex items-center gap-2 select-none">
              <NvLogo className="w-7 h-7" />
              <span className="text-base font-bold tracking-tight text-slate-100">
                new<span className="text-blue-400">.vote</span>
              </span>
            </Link>
          </div>

          {/* Centre: desktop logo */}
          <Link href="/" className="hidden sm:flex absolute left-1/2 -translate-x-1/2 items-center gap-2 select-none">
            <NvLogo className="w-8 h-8" />
            <span className="text-lg font-bold tracking-tight text-slate-100">
              new<span className="text-blue-400">.vote</span>
            </span>
          </Link>

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
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold text-amber-400 leading-none">sys</span>
                  )}
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors px-2 py-1.5">Login</Link>
                <Link href="/pricing" className="rounded-lg border border-blue-700/40 px-3 py-1.5 text-sm font-medium text-blue-400 transition-colors hover:border-blue-500/70 hover:bg-blue-500/10">Sign up</Link>
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

      {/* ── Slide-in nav drawer ───────────────────────────────────────────────── */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`nav-drawer fixed top-0 left-0 z-50 h-full w-72 bg-dr-card border-r border-blue-900/20 flex flex-col transform transition-transform duration-300 ease-in-out ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-blue-900/15 flex-shrink-0">
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
        <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-0.5">

          {/* ── HOME ── */}
          <NavLabel>Home</NavLabel>
          <NavLink href="/scotparl" onClick={close} pathname={pathname} icon={icons.dashboard}>
            Dashboard
          </NavLink>

          <NavDivider />

          {/* ── NEW SOCIETY ── */}
          <NavLabel>New Society</NavLabel>
          <NavLink href={user ? chamberHref : '/chamber'} onClick={close} pathname={pathname} icon={icons.debate}>
            Debate &amp; Vote
          </NavLink>
          <NavLink href="/scotparl/bills" onClick={close} pathname={pathname} icon={icons.laws}>
            Laws
          </NavLink>
          <NavLink href="/scotparl/proposals" onClick={close} pathname={pathname} icon={icons.proposals}>
            Proposals
          </NavLink>
          <NavLink href="/scotparl/principles" onClick={close} pathname={pathname} icon={icons.principles}>
            Principles
          </NavLink>

          <NavDivider />

          {/* ── UTILITIES ── */}
          <NavLabel>Utilities</NavLabel>
          <NavLink href="https://voter.care/poll" onClick={close} pathname={pathname} icon={icons.poll} external>
            Poll
          </NavLink>
          <NavLink href="https://voter.care/elect" onClick={close} pathname={pathname} icon={icons.elect} external>
            Elect
          </NavLink>
          <NavLink href="https://tasks.debate.report" onClick={close} pathname={pathname} icon={icons.task} external>
            Share Task
          </NavLink>

          <NavDivider />

          {/* ── ACCOUNT ── */}
          {user ? (
            <>
              <NavLabel>Admin</NavLabel>
              <NavLink href="/profile" onClick={close} pathname={pathname} icon={icons.profile}>
                Profile &amp; Billing
              </NavLink>
              {adminRole?.isCustomerAdmin && (
                <NavLink href="/scotparl/admin" onClick={close} pathname={pathname} icon={icons.settings}>
                  Settings (Customer)
                </NavLink>
              )}
              {adminRole?.isTopicOwner && !adminRole?.isCustomerAdmin && (
                <NavLink href="/scotparl/admin" onClick={close} pathname={pathname} icon={icons.settings}>
                  Settings (Topics)
                </NavLink>
              )}
              {user.isSysAdmin && (
                <NavLink href="/admin" onClick={close} pathname={pathname} icon={icons.settings}>
                  Settings (Site)
                </NavLink>
              )}
              {isMod && (
                <NavLink href="/dashboard" onClick={close} pathname={pathname} icon={icons.task}>
                  Mod Tools
                </NavLink>
              )}
              <button
                onClick={() => { logout(); close(); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <span className="text-slate-600">{icons.logout}</span>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLabel>Account</NavLabel>
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
            Help System
          </NavLink>
          {canManage && (
            <NavLink href="/admin/contact-platform" onClick={close} pathname={pathname} icon={icons.contact}>
              Contact Platform Admin
            </NavLink>
          )}

          <NavDivider />

          {/* ── TOPICS (collapsible) ── */}
          <button
            onClick={() => setTopicsOpen(o => !o)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-blue-500/10 hover:text-slate-300"
          >
            <span className="flex items-center gap-3">
              <span className="text-slate-600">{icons.topics}</span>
              Topics
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

        </nav>
      </div>
    </>
  );
}
