'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DrLogo } from './DrLogo';

export default function Footer() {
  const [helpVisible, setHelpVisible] = useState(false);

  const isLoggedIn = false;
  const isSysAdmin = false;
  const userHandle = '';
  const userRole = '';

  return (
    <footer className="border-t border-blue-900/15 bg-[#04060b] text-slate-400 text-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">

          <Link href="/" className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
            <DrLogo className="w-6 h-6" />
            <span className="font-semibold text-slate-300 text-xs tracking-wide">debate.report</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/terms"   className="hover:text-blue-400 transition-colors">Terms & Conditions</Link>
            <Link href="/privacy" className="hover:text-blue-400 transition-colors">Privacy Policy</Link>
            <Link href="/about"   className="hover:text-blue-400 transition-colors">About Us</Link>
            <Link href="/news"    className="hover:text-blue-400 transition-colors">News</Link>
            <Link href="/contact" className="hover:text-blue-400 transition-colors">Contact Us</Link>
            {isSysAdmin && (
              <Link href="/sysadmin" className="text-amber-400 hover:text-amber-300 transition-colors font-medium">
                SysAdmin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-4">
            {isLoggedIn && userHandle && (
              <span className="text-xs text-slate-500">
                {userHandle}
                {userRole && <span className="ml-1 text-blue-500/70">({userRole})</span>}
              </span>
            )}
            <button
              onClick={() => setHelpVisible(v => !v)}
              className={`text-xs rounded-md border px-2.5 py-1 transition-colors ${
                helpVisible
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                  : 'border-slate-700 hover:border-blue-600/40 hover:text-blue-400'
              }`}
            >
              {helpVisible ? '? Help On' : '? Toggle Help Links'}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} debate.report — All debates are strictly moderated.
        </p>
      </div>
    </footer>
  );
}
