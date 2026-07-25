'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

const SUBJECT_LABELS: Record<string, string> = {
  culture: 'Culture', economics: 'Economics', education: 'Education',
  environment: 'Environment', future: 'Future', health: 'Health',
  history: 'History', law: 'Law', media: 'Media',
  philosophy: 'Philosophy', politics: 'Politics', science: 'Science',
};

const SUBJECT_COLOURS: Record<string, string> = {
  culture: 'bg-pink-500/10 text-pink-300', economics: 'bg-emerald-500/10 text-emerald-300',
  education: 'bg-sky-500/10 text-sky-300', environment: 'bg-green-500/10 text-green-300',
  future: 'bg-violet-500/10 text-violet-300', health: 'bg-rose-500/10 text-rose-300',
  history: 'bg-amber-500/10 text-amber-300', law: 'bg-slate-500/10 text-slate-300',
  media: 'bg-cyan-500/10 text-cyan-300', philosophy: 'bg-indigo-500/10 text-indigo-300',
  politics: 'bg-blue-500/10 text-blue-300', science: 'bg-teal-500/10 text-teal-300',
};

type Debate = {
  id: string;
  stat_title: string;
  subject_area: string;
  forum_visibility: string;
  image_path: string | null;
  created_at: string;
  creator_handle: string | null;
  child_count: number;
};

export default function ListDebatesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [debates, setDebates]     = useState<Debate[]>([]);
  const [fetching, setFetching]   = useState(true);
  const [error, setError]         = useState('');
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/debates');
    if (!loading && user && user.tier !== 'moderator' && !user.isSysAdmin) router.push('/dashboard');
  }, [loading, user, router]);

  const fetchDebates = useCallback(async () => {
    setFetching(true);
    setError('');
    try {
      const res = await fetch('/api/debates');
      if (!res.ok) throw new Error('Failed to load debates');
      setDebates(await res.json());
    } catch {
      setError('Could not load debates. Please refresh.');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { fetchDebates(); }, [fetchDebates]);

  async function handleDelete(debate: Debate) {
    if (debate.child_count > 0) return;
    if (!confirm(`Delete "${debate.stat_title.slice(0, 60)}…"? This cannot be undone.`)) return;

    setDeleting(debate.id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/debates/${debate.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setDeleteError(data.error ?? 'Delete failed'); return; }
      setDebates(d => d.filter(x => x.id !== debate.id));
    } catch {
      setDeleteError('Delete failed. Please try again.');
    } finally {
      setDeleting(null);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-dr-base px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <Link href="/dashboard" className="hover:text-slate-300 transition-colors">Dashboard</Link>
              <span>/</span>
              <span className="text-slate-300">Debates</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100">Debate Resolutions</h1>
            <p className="text-sm text-slate-500 mt-1">{debates.length} resolution{debates.length !== 1 ? 's' : ''}</p>
          </div>
          <Link
            href="/dashboard/new-debate"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New debate
          </Link>
        </div>

        {deleteError && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {deleteError}
          </div>
        )}

        {fetching ? (
          <div className="text-center py-20 text-slate-500 text-sm">Loading…</div>
        ) : error ? (
          <div className="text-center py-20 text-red-400 text-sm">{error}</div>
        ) : debates.length === 0 ? (
          <div className="card-dr p-12 text-center">
            <p className="text-slate-400 text-sm">No debates yet.</p>
            <Link href="/dashboard/new-debate" className="mt-4 inline-block text-blue-400 text-sm hover:underline">
              Create the first one →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {debates.map(debate => (
              <div key={debate.id} className="card-dr flex items-start gap-4 p-4">

                {/* Thumbnail */}
                {debate.image_path ? (
                  <img
                    src={debate.image_path}
                    alt=""
                    className="h-16 w-24 flex-shrink-0 rounded-lg object-cover border border-slate-700"
                  />
                ) : (
                  <div className="h-16 w-24 flex-shrink-0 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <svg className="h-6 w-6 text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                    </svg>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-100 line-clamp-2 leading-snug">
                    {debate.stat_title}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SUBJECT_COLOURS[debate.subject_area] ?? 'bg-slate-700 text-slate-400'}`}>
                      {SUBJECT_LABELS[debate.subject_area] ?? debate.subject_area}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(debate.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {debate.creator_handle && (
                      <span className="text-xs text-slate-600">@{debate.creator_handle}</span>
                    )}
                    {debate.child_count > 0 && (
                      <span className="text-xs text-amber-400/80">
                        {debate.child_count} statement{debate.child_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={`/debates/${debate.id}`}
                    target="_blank"
                    className="rounded-lg p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
                    title="View"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  </Link>
                  <Link
                    href={`/dashboard/debates/${debate.id}/edit`}
                    className="rounded-lg p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                    title="Edit"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => handleDelete(debate)}
                    disabled={debate.child_count > 0 || deleting === debate.id}
                    title={debate.child_count > 0 ? `Cannot delete: ${debate.child_count} statement${debate.child_count !== 1 ? 's' : ''} attached` : 'Delete'}
                    className="rounded-lg p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-slate-500 disabled:hover:bg-transparent"
                  >
                    {deleting === debate.id ? (
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
