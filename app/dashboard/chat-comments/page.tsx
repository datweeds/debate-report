'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Comment = {
  id: string; body: string; created_at: string; status: string;
  statement_id: string; stat_ref: string | null; stat_title: string;
  resolution_id: string; resolution_title: string;
};

export default function ChatCommentsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Comment[] | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/chat-comments');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/user/chat-comments').then(r => r.ok ? r.json() : { comments: [] })
      .then(d => setItems(d.comments ?? [])).catch(() => setItems([]));
  }, [user]);

  if (loading || !user) return null;

  return (
    <div className="px-4 sm:px-8 py-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Chat Comments</h1>
        <p className="text-sm text-slate-500 mt-1">All chat messages you have posted across debates</p>
      </div>
      {items === null ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-slate-800/40 animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-10 text-center text-sm text-slate-500">
          You haven&apos;t posted any chat messages yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map(c => (
            <li key={c.id} className="rounded-xl border border-slate-800 bg-[#0c1322] p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Link href={`/chamber?resolution=${c.resolution_id}&statement=${c.statement_id}`} className="truncate hover:text-blue-300">
                  {c.stat_ref && <span className="font-mono font-bold text-slate-300 mr-1">{c.stat_ref}</span>}{c.stat_title}
                </Link>
                {c.status !== 'accepted' && <span className="rounded border border-amber-500/40 px-1.5 text-amber-300">{c.status}</span>}
                <span className="ml-auto shrink-0">{new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <p className="mt-2 text-sm text-slate-200 whitespace-pre-line">{c.body}</p>
              <p className="mt-1 text-xs text-slate-600 truncate">{c.resolution_title}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
