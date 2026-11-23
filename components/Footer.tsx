'use client';

import Link from 'next/link';
import { NvLogo } from './NvLogo';
import { useAuth } from './AuthProvider';
import { COMPANY } from '@/lib/company';

function FooterLink({ href, external, children }: { href: string; external?: boolean; children: React.ReactNode }) {
  const cls = 'text-sm text-slate-400 underline-offset-4 decoration-blue-400/50 transition-colors duration-200 hover:text-blue-300 hover:underline flex items-center gap-1';
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

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav aria-label={title}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-300">{title}</p>
      <ul className="space-y-2">{children}</ul>
    </nav>
  );
}

export default function Footer() {
  const { user } = useAuth();

  return (
    <>
      <footer className="dr-pin-main border-t border-blue-900/15 bg-[#04060b] text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 py-12">

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">

            {/* Brand */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-1 max-w-xs">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <NvLogo className="w-8 h-8" />
                <span className="font-bold text-slate-100 text-base">
                  new<span className="text-blue-400">.vote</span>
                </span>
              </Link>
              <p className="text-xs text-slate-500 leading-relaxed">
                One place for your community to talk, plan and decide together. Free to start.
              </p>
              <Link href="/blog" className="mt-4 inline-block text-sm font-medium text-blue-400 underline-offset-4 decoration-blue-400/50 transition-colors hover:text-blue-300 hover:underline">Subscribe to the newsletter →</Link>
            </div>

            <FooterColumn title="Explore">
              <li><FooterLink href="/features">Features</FooterLink></li>
              <li><FooterLink href="/#societies">Find a Society</FooterLink></li>
              <li><FooterLink href="/chamber">Debates</FooterLink></li>
              <li><FooterLink href="/blog">Newsletter</FooterLink></li>
            </FooterColumn>

            <FooterColumn title="Start a Society">
              <li><FooterLink href={user ? '/dashboard/societies' : '/register'}>{user ? 'Start a Society' : 'Sign up'}</FooterLink></li>
              <li><FooterLink href="/pricing">Pricing</FooterLink></li>
              {user && <li><FooterLink href="/dashboard/societies">Manage your Societies</FooterLink></li>}
              <li><FooterLink href="/support">Support &amp; Investors</FooterLink></li>
            </FooterColumn>

            <FooterColumn title="Help">
              <li><FooterLink href="/guides">Guides</FooterLink></li>
              <li><FooterLink href="/young-people">For young people</FooterLink></li>
              <li><FooterLink href="https://debate.support" external>Help centre</FooterLink></li>
              <li><FooterLink href="/status">Status</FooterLink></li>
              <li><FooterLink href="/service">Service description</FooterLink></li>
              <li><FooterLink href="/contact">Contact</FooterLink></li>
              <li><Link href="/about" className="text-sm text-slate-400 underline-offset-4 decoration-blue-400/50 transition-colors duration-200 hover:text-blue-300 hover:underline">About</Link></li>
            </FooterColumn>

            <FooterColumn title="Trust">
              <li><FooterLink href="/privacy">Privacy policy</FooterLink></li>
              <li><FooterLink href="/terms">Terms &amp; conditions</FooterLink></li>
              <li><FooterLink href="/features#privacy">How we protect your data</FooterLink></li>
              <li><FooterLink href="/security">Report a security problem</FooterLink></li>
            </FooterColumn>
          </div>

          {/* What we stand for */}
          <p className="mt-10 flex flex-wrap justify-center gap-x-5 gap-y-1 border-t border-blue-900/10 pt-6 text-sm text-slate-500">
            {['Free to start', 'Encrypted private Societies', 'Polls and secret ballots', 'No ads or tracking', 'Your choice of AI'].map((t, i) => (
              <span key={t} className="flex items-center gap-5">{i > 0 && <span aria-hidden="true" className="text-slate-700">·</span>}{t}</span>
            ))}
          </p>

          {/* Bottom bar */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-blue-900/10 pt-6">
            <p className="text-xs text-slate-700">
              © {new Date().getFullYear()} {COMPANY.name}. All rights reserved.
              {/* Company details every UK company website must show */}
              <span className="block mt-1">
                Registered in {COMPANY.registeredIn}, company number {COMPANY.number}
                {COMPANY.registeredOffice ? <>. Registered office: {COMPANY.registeredOffice}</> : null}.
              </span>
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

    </>
  );
}
