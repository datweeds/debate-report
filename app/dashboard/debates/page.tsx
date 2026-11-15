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

const DECISION_LABEL: Record<string, string> = {
  for:     'For wins',
  against: 'Against wins',
  draw:    'Draw',
};

type Debate = {
  id: string;
  stat_title: string;
  subject_area: string;
  debate_visibility: string;
  image_path: string | null;
  created_at: string;
  creator_handle: string | null;
  created_by: string | null;
  stat_status: string;
  resolution_decision: string | null;
  vote_total_for: number;
  vote_total_against: number;
  child_count: number;
  customer_id: number | null;
  society_name: string | null;
  society_is_public: boolean | null;
  can_set_visibility: boolean;
};

type SocietyOption = { id: number; name: string };

type CloseForm = {
  decision: 'for' | 'against' | 'draw' | '';
  rationale: string;
  hidden: boolean;
};

export default function ListDebatesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [debates, setDebates]     = useState<Debate[]>([]);
  const [fetching, setFetching]   = useState(true);
  const [error, setError]         = useState('');
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Close form state
  const [closingId,    setClosingId]    = useState<string | null>(null);
  const [closeForm,    setCloseForm]    = useState<CloseForm>({ decision: '', rationale: '', hidden: false });
  const [closeSubmitting, setCloseSubmitting] = useState(false);
  const [closeError,   setCloseError]   = useState('');

  // Move-to-society state
  const [movingId,     setMovingId]     = useState<string | null>(null);
  const [societies,    setSocieties]    = useState<SocietyOption[]>([]);
  const [moveTarget,   setMoveTarget]   = useState<number | ''>('');
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const [moveError,    setMoveError]    = useState('');
  const [moveMode,     setMoveMode]     = useState<'move' | 'copy'>('copy');
  const [moveVotes,    setMoveVotes]    = useState(true);
  const [moveChat,     setMoveChat]     = useState(true);

  // Visibility (Public/Apply/Invite) state
  const [visibilityId, setVisibilityId] = useState<string | null>(null);
  const [inviteHandle,  setInviteHandle] = useState('');
  const [visSubmitting, setVisSubmitting] = useState(false);
  const [visError,      setVisError]      = useState('');
  const [visNotice,     setVisNotice]     = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/debates');
    if (!loading && user && user.tier !== 'moderator') router.push('/scotparl');
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

  // Societies a debate can be moved between: the ones this moderator moderates
  useEffect(() => {
    if (!user) return;
    fetch('/api/me/roles')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSocieties(d.moderatedSocieties ?? []); })
      .catch(() => {});
  }, [user]);

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

  function openCloseForm(debate: Debate) {
    setClosingId(debate.id);
    setCloseForm({ decision: '', rationale: '', hidden: false });
    setCloseError('');
  }

  function cancelClose() {
    setClosingId(null);
    setCloseError('');
  }

  async function submitClose(debate: Debate) {
    if (!closeForm.decision) { setCloseError('Please select a decision'); return; }
    if (!closeForm.rationale.trim()) { setCloseError('Rationale is required'); return; }
    setCloseSubmitting(true); setCloseError('');
    try {
      const res = await fetch(`/api/debates/${debate.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision:  closeForm.decision,
          rationale: closeForm.rationale,
          hidden:    closeForm.hidden,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCloseError(data.error ?? 'Close failed'); return; }
      // Update local state
      setDebates(prev => prev.map(d =>
        d.id === debate.id
          ? { ...d, stat_status: 'closed', resolution_decision: closeForm.decision }
          : d
      ));
      setClosingId(null);
    } catch {
      setCloseError('Network error');
    } finally {
      setCloseSubmitting(false);
    }
  }

  function openMoveForm(debate: Debate) {
    setMovingId(debate.id);
    setMoveTarget('');
    setMoveError('');
    setMoveMode('copy'); setMoveVotes(true); setMoveChat(true);
  }

  function cancelMove() {
    setMovingId(null);
    setMoveError('');
  }

  async function submitMove(debate: Debate) {
    if (!moveTarget) { setMoveError('Please select a society'); return; }
    if (moveMode === 'move' && (!moveVotes || !moveChat)
        && !confirm(`Moving without ${[!moveVotes && 'votes', !moveChat && 'chat'].filter(Boolean).join(' or ')} permanently deletes this debate's ${[!moveVotes && 'votes', !moveChat && 'chat'].filter(Boolean).join(' and ')}. Continue?`)) return;
    setMoveSubmitting(true); setMoveError('');
    try {
      const res = await fetch(`/api/debates/${debate.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetSocietyId: moveTarget, mode: moveMode, includeVotes: moveVotes, includeChat: moveChat }),
      });
      const data = await res.json();
      if (!res.ok) { setMoveError(data.error ?? `${moveMode === 'move' ? 'Move' : 'Copy'} failed`); return; }
      // A copy adds a new debate to the list; a move changes this one
      await fetchDebates();
      setMovingId(null);
    } catch {
      setMoveError('Network error');
    } finally {
      setMoveSubmitting(false);
    }
  }

  function openVisibilityForm(debate: Debate) {
    setVisibilityId(debate.id);
    setInviteHandle('');
    setVisError('');
    setVisNotice('');
  }

  function cancelVisibility() {
    setVisibilityId(null);
    setVisError('');
    setVisNotice('');
  }

  async function submitVisibility(debate: Debate, visibility: string) {
    setVisSubmitting(true); setVisError(''); setVisNotice('');
    try {
      const res = await fetch(`/api/debates/${debate.id}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility }),
      });
      const data = await res.json();
      if (!res.ok) { setVisError(data.error ?? 'Update failed'); return; }
      setDebates(prev => prev.map(d => d.id === debate.id ? { ...d, debate_visibility: visibility } : d));
    } catch {
      setVisError('Network error');
    } finally {
      setVisSubmitting(false);
    }
  }

  async function submitInvite(debate: Debate) {
    if (!inviteHandle.trim()) { setVisError('Enter a handle'); return; }
    setVisSubmitting(true); setVisError(''); setVisNotice('');
    try {
      const res = await fetch(`/api/debates/${debate.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: inviteHandle.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setVisError(data.error ?? 'Invite failed'); return; }
      setVisNotice(`Invited @${inviteHandle.trim()}.`);
      setInviteHandle('');
    } catch {
      setVisError('Network error');
    } finally {
      setVisSubmitting(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="px-8 py-10">
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
              <div key={debate.id}>
                <div className={`card-dr flex items-start gap-4 p-4 ${(closingId === debate.id || movingId === debate.id || visibilityId === debate.id) ? 'rounded-b-none border-b-0' : ''}`}>

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
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold text-slate-100 line-clamp-2 leading-snug">
                        {debate.stat_title}
                      </p>
                      {debate.stat_status === 'closed' && (
                        <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-500/30">
                          Closed
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SUBJECT_COLOURS[debate.subject_area] ?? 'bg-slate-700 text-slate-400'}`}>
                        {SUBJECT_LABELS[debate.subject_area] ?? debate.subject_area}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(debate.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {debate.creator_handle && (
                        <span className="text-xs text-slate-600">@{debate.creator_handle}</span>
                      )}
                      {debate.society_name && (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-slate-700/60 text-slate-400">
                          {debate.society_name}
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        debate.debate_visibility === 'public'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : debate.debate_visibility === 'apply'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-violet-500/10 text-violet-400'
                      }`}>
                        {debate.debate_visibility}
                      </span>
                      {debate.child_count > 0 && (
                        <span className="text-xs text-amber-400/80">
                          {debate.child_count} statement{debate.child_count !== 1 ? 's' : ''}
                        </span>
                      )}
                      {debate.stat_status === 'closed' && debate.resolution_decision && (
                        <span className="text-xs text-slate-500">
                          · {DECISION_LABEL[debate.resolution_decision] ?? debate.resolution_decision}
                          <span className="ml-2 text-emerald-400">✓ {debate.vote_total_for}</span>
                          <span className="ml-1 text-rose-400">✗ {debate.vote_total_against}</span>
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
                    {debate.stat_status === 'active' && debate.can_set_visibility && (
                      <button
                        onClick={() => closingId === debate.id ? cancelClose() : openCloseForm(debate)}
                        title="Close debate"
                        className={`rounded-lg p-2 transition-colors ${
                          closingId === debate.id
                            ? 'text-orange-400 bg-orange-500/10'
                            : 'text-slate-500 hover:text-orange-400 hover:bg-orange-500/10'
                        }`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                      </button>
                    )}
                    {debate.can_set_visibility && (
                      <button
                        onClick={() => visibilityId === debate.id ? cancelVisibility() : openVisibilityForm(debate)}
                        title="Debate visibility"
                        className={`rounded-lg p-2 transition-colors ${
                          visibilityId === debate.id
                            ? 'text-amber-400 bg-amber-500/10'
                            : 'text-slate-500 hover:text-amber-400 hover:bg-amber-500/10'
                        }`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      </button>
                    )}
                    {societies.length > 1 && (
                      <button
                        onClick={() => movingId === debate.id ? cancelMove() : openMoveForm(debate)}
                        title="Move or copy to another society"
                        className={`rounded-lg p-2 transition-colors ${
                          movingId === debate.id
                            ? 'text-violet-400 bg-violet-500/10'
                            : 'text-slate-500 hover:text-violet-400 hover:bg-violet-500/10'
                        }`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                        </svg>
                      </button>
                    )}
                    {debate.stat_status !== 'closed' && (
                      <Link
                        href={`/dashboard/debates/${debate.id}/edit`}
                        className="rounded-lg p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        title="Edit"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                        </svg>
                      </Link>
                    )}
                    <button
                      onClick={() => handleDelete(debate)}
                      disabled={debate.child_count > 0 || deleting === debate.id || debate.stat_status === 'closed'}
                      title={
                        debate.stat_status === 'closed'
                          ? 'Cannot delete a closed debate'
                          : debate.child_count > 0
                          ? `Cannot delete: ${debate.child_count} statement${debate.child_count !== 1 ? 's' : ''} attached`
                          : 'Delete'
                      }
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

                {/* Inline close form */}
                {closingId === debate.id && (
                  <ClosePanel
                    debate={debate}
                    form={closeForm}
                    onFormChange={setCloseForm}
                    onSubmit={() => submitClose(debate)}
                    onCancel={cancelClose}
                    submitting={closeSubmitting}
                    error={closeError}
                  />
                )}

                {/* Inline move form */}
                {movingId === debate.id && (
                  <MovePanel
                    debate={debate}
                    societies={societies}
                    target={moveTarget}
                    onTargetChange={setMoveTarget}
                    onSubmit={() => submitMove(debate)}
                    onCancel={cancelMove}
                    submitting={moveSubmitting}
                    error={moveError}
                    mode={moveMode} onModeChange={setMoveMode}
                    includeVotes={moveVotes} onVotesChange={setMoveVotes}
                    includeChat={moveChat} onChatChange={setMoveChat}
                  />
                )}

                {/* Inline visibility form */}
                {visibilityId === debate.id && (
                  <VisibilityPanel
                    debate={debate}
                    inviteHandle={inviteHandle}
                    onInviteHandleChange={setInviteHandle}
                    onSetVisibility={v => submitVisibility(debate, v)}
                    onInvite={() => submitInvite(debate)}
                    onCancel={cancelVisibility}
                    submitting={visSubmitting}
                    error={visError}
                    notice={visNotice}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClosePanel({
  debate, form, onFormChange, onSubmit, onCancel, submitting, error,
}: {
  debate: Debate;
  form: CloseForm;
  onFormChange: (f: CloseForm) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  error: string;
}) {
  const totalVotes = debate.vote_total_for + debate.vote_total_against;
  const forPct = totalVotes > 0 ? Math.round((debate.vote_total_for / totalVotes) * 100) : 50;

  return (
    <div className="card-dr rounded-t-none border-t border-orange-500/20 bg-orange-500/5 p-5">
      <p className="text-sm font-semibold text-slate-200 mb-4">Close this debate</p>

      {/* Current metrics */}
      <div className="mb-5 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
        <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Current vote totals</p>
        <div className="flex items-center gap-6 mb-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">{debate.vote_total_for}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total For</p>
          </div>
          <div className="flex-1">
            <div className="h-3 rounded-full overflow-hidden bg-rose-500/30">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${forPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-slate-600">For {forPct}%</span>
              <span className="text-[10px] text-slate-600">{100 - forPct}% Against</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-rose-400">{debate.vote_total_against}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Against</p>
          </div>
        </div>
        <p className="text-xs text-slate-600">
          These totals will be published alongside your decision.
        </p>
      </div>

      {/* Decision picker */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-400 mb-2">Your decision</label>
        <div className="flex gap-2">
          {(['for', 'against', 'draw'] as const).map(d => (
            <button
              key={d}
              onClick={() => onFormChange({ ...form, decision: d })}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                form.decision === d
                  ? d === 'for'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                    : d === 'against'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-300'
                    : 'border-slate-500 bg-slate-700 text-slate-300'
                  : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400'
              }`}
            >
              {d === 'for' ? '✓ For wins' : d === 'against' ? '✗ Against wins' : '≈ Draw'}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-1.5">
          Consider the vote totals above. Your decision is final and published publicly.
        </p>
      </div>

      {/* Rationale */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
          Rationale <span className="text-red-400">*</span>
        </label>
        <textarea
          value={form.rationale}
          onChange={e => onFormChange({ ...form, rationale: e.target.value })}
          placeholder="Explain your decision, referring to the arguments made and the vote totals…"
          rows={4}
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:border-orange-500/50 focus:outline-none resize-none"
        />
      </div>

      {/* Visibility option */}
      <label className="flex items-start gap-3 mb-4 cursor-pointer group">
        <div className="relative mt-0.5">
          <input
            type="checkbox"
            checked={form.hidden}
            onChange={e => onFormChange({ ...form, hidden: e.target.checked })}
            className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-orange-500"
          />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-300 group-hover:text-slate-200 transition-colors">
            Remove from Chamber and Switch
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            By default, closed debates remain visible. Check this to hide the debate from public view.
          </p>
        </div>
      </label>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Closing…' : 'Close debate'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl border border-slate-700 px-5 py-2 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function VisibilityPanel({
  debate, inviteHandle, onInviteHandleChange, onSetVisibility, onInvite, onCancel, submitting, error, notice,
}: {
  debate: Debate;
  inviteHandle: string;
  onInviteHandleChange: (v: string) => void;
  onSetVisibility: (v: string) => void;
  onInvite: () => void;
  onCancel: () => void;
  submitting: boolean;
  error: string;
  notice: string;
}) {
  const OPTIONS = [
    { value: 'public', label: 'Public', hint: 'Visible to everyone.', disabled: !debate.society_is_public },
    { value: 'apply',  label: 'Apply',  hint: 'Society members can see it listed and request access.' },
    { value: 'invite', label: 'Invite', hint: "Only visible to members who've been invited." },
  ];

  return (
    <div className="card-dr rounded-t-none border-t border-amber-500/20 bg-amber-500/5 p-5">
      <p className="text-sm font-semibold text-slate-200 mb-1">Debate visibility</p>
      <p className="text-xs text-slate-500 mb-4">
        {debate.society_is_public
          ? 'This debate’s Society is public — all three options are available.'
          : 'This debate’s Society is private — it can only ever be Apply or Invite.'}
      </p>

      <div className="flex gap-2 mb-4">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => !opt.disabled && onSetVisibility(opt.value)}
            disabled={submitting || opt.disabled}
            title={opt.disabled ? 'Not available — this Society is private' : opt.hint}
            className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              debate.debate_visibility === opt.value
                ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {debate.debate_visibility === 'invite' && (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Invite a Society member by handle</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inviteHandle}
              onChange={e => onInviteHandleChange(e.target.value)}
              placeholder="handle"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-amber-500/50 focus:outline-none"
            />
            <button
              onClick={onInvite}
              disabled={submitting || !inviteHandle.trim()}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
            >
              Invite
            </button>
          </div>
          <p className="text-xs text-slate-600 mt-1.5">
            Must already be a member of this debate&rsquo;s Society. They&rsquo;ll see it in their Invitations list.
          </p>
        </div>
      )}

      {notice && <p className="text-xs text-emerald-400 mb-3">{notice}</p>}
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <button
        onClick={onCancel}
        className="rounded-xl border border-slate-700 px-5 py-2 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
      >
        Done
      </button>
    </div>
  );
}

function MovePanel({
  debate, societies, target, onTargetChange, onSubmit, onCancel, submitting, error,
  mode, onModeChange, includeVotes, onVotesChange, includeChat, onChatChange,
}: {
  debate: Debate;
  societies: SocietyOption[];
  target: number | '';
  onTargetChange: (id: number | '') => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  error: string;
  mode: 'move' | 'copy'; onModeChange: (m: 'move' | 'copy') => void;
  includeVotes: boolean; onVotesChange: (v: boolean) => void;
  includeChat: boolean; onChatChange: (v: boolean) => void;
}) {
  const losing = mode === 'move' && (!includeVotes || !includeChat);
  return (
    <div className="card-dr rounded-t-none border-t border-violet-500/20 bg-violet-500/5 p-5">
      <p className="text-sm font-semibold text-slate-200 mb-1">Move or copy to another society</p>
      <p className="text-xs text-slate-500 mb-4">
        Currently in <span className="text-slate-300">{debate.society_name ?? 'no society'}</span>.
        Every statement, reference, link and analysis goes with it; choose whether votes and chat do too.
      </p>

      <div className="mb-4 flex gap-2">
        {(['copy', 'move'] as const).map(m => (
          <button key={m} type="button" onClick={() => onModeChange(m)}
            className={`flex-1 rounded-xl border px-4 py-2 text-left text-sm ${mode === m ? 'border-violet-500/60 bg-violet-500/15 text-violet-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
            <span className="font-semibold">{m === 'copy' ? 'Copy' : 'Move'}</span>
            <span className="block text-xs opacity-75">{m === 'copy' ? 'Keep this debate here and add a copy there' : 'Take this debate out of this society'}</span>
          </button>
        ))}
      </div>

      <label className="block text-xs font-semibold text-slate-400 mb-1.5">To</label>
      <select
        value={target}
        onChange={e => onTargetChange(e.target.value ? Number(e.target.value) : '')}
        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 focus:border-violet-500/50 focus:outline-none mb-4"
      >
        <option value="">Select a society…</option>
        {societies.filter(s => mode === 'copy' || s.id !== debate.customer_id).map(s => (
          <option key={s.id} value={s.id}>{s.name}{s.id === debate.customer_id ? ' (this society)' : ''}</option>
        ))}
      </select>

      <div className="mb-3 flex flex-wrap gap-5 text-sm text-slate-300">
        <label className="flex items-center gap-2"><input type="checkbox" checked={includeVotes} onChange={e => onVotesChange(e.target.checked)} className="accent-violet-500" /> Include votes</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={includeChat} onChange={e => onChatChange(e.target.checked)} className="accent-violet-500" /> Include chat</label>
      </div>
      {losing && (
        <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Moving without {[!includeVotes && 'votes', !includeChat && 'chat'].filter(Boolean).join(' or ')} permanently deletes this debate&apos;s {[!includeVotes && 'votes', !includeChat && 'chat'].filter(Boolean).join(' and ')}. Copy instead to keep the original intact.
        </p>
      )}

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={submitting || !target}
          className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
        >
          {submitting ? (mode === 'copy' ? 'Copying…' : 'Moving…') : mode === 'copy' ? 'Copy debate' : 'Move debate'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl border border-slate-700 px-5 py-2 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
