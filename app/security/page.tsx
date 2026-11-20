import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reporting a security problem',
  description: 'How to tell new.vote about a security vulnerability, and what we ask of researchers.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-dr p-7">
      <h2 className="text-xl font-bold text-slate-100 mb-4">{title}</h2>
      <div className="space-y-3 text-sm text-slate-300 leading-relaxed">{children}</div>
    </div>
  );
}

const a = 'text-blue-400 hover:text-blue-300';

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-dr-base px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
            <Link href="/" className="hover:text-slate-300 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-slate-300">Security</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-100">Reporting a security problem</h1>
          <p className="mt-2 text-slate-500 text-sm">Last updated: 20 November 2026</p>
        </div>

        <div className="space-y-6">
          <Section title="How to report">
            <p>
              If you think you&apos;ve found a security vulnerability in new.vote, please email{' '}
              <a href="mailto:security@new.vote" className={a}>security@new.vote</a>{' '}
              or use the <Link href="/contact" className={a}>contact form</Link>.
            </p>
            <p>Please include what you found, where (the page or address), the steps to reproduce it, and what someone could do with it. Screenshots help.</p>
            <p>We aim to acknowledge reports within 5 working days, keep you informed while we fix the problem, and credit you once it&apos;s fixed if you&apos;d like.</p>
          </Section>

          <Section title="What we ask">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Give us a reasonable time to fix the problem before telling anyone else about it.</li>
              <li>Only use accounts and Societies you own or have permission to test. Don&apos;t access, change or delete other people&apos;s data: if you come across any, stop and tell us.</li>
              <li>Don&apos;t run denial-of-service tests, send spam, or use social engineering or physical attacks.</li>
              <li>Don&apos;t use automated scanners in a way that degrades the service for others.</li>
            </ul>
            <p>If you follow these guidelines in good faith, we won&apos;t take legal action against you over your research.</p>
          </Section>

          <Section title="In scope">
            <p>new.vote and its Society sites (*.new.vote). Reports about missing best practices with no realistic impact are welcome, but may not be acted on quickly.</p>
            <p>
              Machine-readable contact details are at{' '}
              <a href="/.well-known/security.txt" className={a}>/.well-known/security.txt</a>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
