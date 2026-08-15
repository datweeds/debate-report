'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function UnsubscribeContent() {
  const params = useSearchParams();
  const token  = params.get('token');
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    fetch('/api/blog/unsubscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token }),
    })
      .then(r => setStatus(r.ok ? 'ok' : 'error'))
      .catch(() => setStatus('error'));
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <p className="text-slate-400 text-sm">Unsubscribing…</p>
      </div>
    );
  }

  if (status === 'ok') {
    return (
      <>
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 mb-3">You&apos;ve been unsubscribed</h1>
        <p className="text-slate-400 text-sm mb-8">
          You won&apos;t receive any more blog emails from debate.report.
          You can resubscribe any time from the{' '}
          <Link href="/blog" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">blog page</Link>.
        </p>
        <Link href="/blog" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
          Back to blog →
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-slate-100 mb-3">Link invalid or expired</h1>
      <p className="text-slate-400 text-sm mb-8">
        This unsubscribe link may be invalid. If you&apos;re still receiving emails,{' '}
        <a href="mailto:hello@debate.report" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
          contact us
        </a>{' '}
        and we&apos;ll remove you manually.
      </p>
      <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
        Go to homepage →
      </Link>
    </>
  );
}

export default function BlogUnsubscribePage() {
  return (
    <div className="min-h-screen bg-dr-base flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center py-20">
        <Suspense fallback={<p className="text-slate-400 text-sm">Loading…</p>}>
          <UnsubscribeContent />
        </Suspense>
      </div>
    </div>
  );
}
