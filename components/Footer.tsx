'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DrLogo } from './DrLogo';
import { useAuth } from './AuthProvider';
import FooterModals, { type FooterModal } from './FooterModals';

export default function Footer() {
  const { user } = useAuth();
  const [helpVisible, setHelpVisible] = useState(false);
  const [modal, setModal] = useState<FooterModal>(null);

  return (
    <>
      <footer className="border-t border-blue-900/15 bg-[#04060b] text-slate-400 text-sm">
        <div className="px-4 sm:px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">

            <Link href="/" className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
              <DrLogo className="w-6 h-6" />
              <span className="font-semibold text-slate-300 text-xs tracking-wide">debate.report</span>
            </Link>

            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <button onClick={() => setModal('about')}   className="hover:text-blue-400 transition-colors">About Us</button>
              <button onClick={() => setModal('contact')} className="hover:text-blue-400 transition-colors">Contact Us</button>
              <button onClick={() => setModal('terms')}   className="hover:text-blue-400 transition-colors">Terms & Conditions</button>
              <button onClick={() => setModal('privacy')} className="hover:text-blue-400 transition-colors">Privacy Policy</button>
              <Link href="/scotparl" className="hover:text-blue-400 transition-colors">ScotParl</Link>
              <Link href="/blog" className="hover:text-blue-400 transition-colors">Blog</Link>
              {user?.isSysAdmin && (
                <Link href="/sysadmin" className="text-amber-400 hover:text-amber-300 transition-colors font-medium">
                  SysAdmin
                </Link>
              )}
            </nav>

            <div className="flex items-center gap-4">
              {user?.handle && (
                <span className="text-xs text-slate-500">
                  {user.handle}
                  {user.tier && <span className="ml-1 text-blue-500/70">({user.tier})</span>}
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
            © Copyright debate.report {new Date().getFullYear()}. All rights reserved.
          </p>
        </div>
      </footer>

      <FooterModals modal={modal} onClose={() => setModal(null)} />
    </>
  );
}
