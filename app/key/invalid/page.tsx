import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Access key not valid', robots: { index: false } };

export default function InvalidKeyPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="card-dr max-w-md w-full p-8 text-center">
        <h1 className="text-xl font-bold text-slate-100 mb-3">This access key isn&apos;t valid</h1>
        <p className="text-sm text-slate-400 mb-6">
          The key may have expired or been withdrawn. If you still need access, please ask the person who sent it
          for a new link.
        </p>
        <Link href="/contact" className="text-sm text-blue-400 hover:text-blue-300">Contact us →</Link>
      </div>
    </div>
  );
}
