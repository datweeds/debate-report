'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NvLogo } from './NvLogo';
import { useAuth } from './AuthProvider';
import FooterModals, { type FooterModal } from './FooterModals';

function FooterLink({ href, external, children }: { href: string; external?: boolean; children: React.ReactNode }) {
  const cls = 'text-sm text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1';
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
        <svg className="h-2.5 w-2.5 opacity-50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
      </a>
    );
  }
  return <Link href={href} className={cls}>{children}</Link>;
}

export default function Footer() {
  const { user } = useAuth();
  const [modal, setModal] = useState<FooterModal>(null);

  return (
    <>
      <footer className="dr-pin-main border-t border-blue-900/15 bg-[#04060b] text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 py-12">

          {/* Brand + Company/Legal */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-[1fr_auto]">

            {/* Brand */}
            <div className="max-w-xs">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <NvLogo className="w-8 h-8" />
                <span className="font-bold text-slate-100 text-base">
                  new<span className="text-blue-400">.vote</span>
                </span>
              </Link>
              <p className="text-xs text-slate-600 leading-relaxed">
                Structured debate and democratic tools for society. Evidence-based. Open to all.
              </p>
            </div>

            {/* Company / Legal — one horizontal row */}
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:justify-end sm:self-center">
              <li><button onClick={() => setModal('about')}   className="text-sm text-slate-500 hover:text-slate-300 transition-colors">About</button></li>
              <li><button onClick={() => setModal('contact')} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Contact</button></li>
              <li><FooterLink href="https://debate.support" external>Help</FooterLink></li>
              <li><Link href="/blog" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Newsletter</Link></li>
              <li><Link href="/support" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Support &amp; Investors</Link></li>
              <li><button onClick={() => setModal('terms')}   className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Terms &amp; Conditions</button></li>
              <li><button onClick={() => setModal('privacy')} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Privacy Policy</button></li>
            </ul>

          </div>

          {/* Bottom bar */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-blue-900/10 pt-6">
            <p className="text-xs text-slate-700">
              © {new Date().getFullYear()} Debate Report Limited. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              {user?.isSysAdmin && (
                <Link href="/sysadmin" className="text-xs text-amber-500/70 hover:text-amber-400 transition-colors font-medium">
                  SysAdmin
                </Link>
              )}
              <a
                href="https://x.com/debatereport"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X / Twitter"
                className="text-slate-700 hover:text-slate-400 transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.632 5.905-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117Z" />
                </svg>
              </a>
            </div>
          </div>

        </div>
      </footer>

      <FooterModals modal={modal} onClose={() => setModal(null)} />
    </>
  );
}
