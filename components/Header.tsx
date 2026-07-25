'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
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

export default function Header() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

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


  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-blue-900/20 bg-[#080d1a]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">

          {/* Left: hamburger */}
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            className="header-theme-toggle flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Centre: logo + wordmark */}
          <Link href="/" className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 select-none">
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
                  {user.handle}
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
          <Link href="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2">
            <DrLogo className="w-7 h-7" />
            <span className="dr-wordmark font-bold text-slate-100">debate<span className="text-gradient-blue">.report</span></span>
          </Link>
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">

          {!user && (
            <>
              <Link
                href="/pricing"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
              >
                <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Sign up / Pricing
              </Link>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
              >
                <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                </svg>
                Log in
              </Link>
              <div className="my-3 border-t border-blue-900/15" />
            </>
          )}

          {user && (
            <>
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
              >
                <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                My Profile
              </Link>
              {(user.tier === 'moderator' || user.isSysAdmin) && (
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
                >
                  <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6" />
                  </svg>
                  Dashboard
                </Link>
              )}
            </>
          )}

          <Link
            href="/chamber"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
          >
            <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8M8 13h5m-9 7 4-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3l-4 4Z" />
            </svg>
            Debate Chamber
          </Link>

          <a
            href="https://debate.support"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
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

          <div className="my-3 border-t border-blue-900/15" />

          {/* Subject Areas collapsible */}
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
                  onClick={() => setMenuOpen(false)}
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
