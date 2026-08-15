'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export type RequestAction = {
  action: string;
  actor_handle: string;
  note: string | null;
  resolution_id: string | null;
  created_at: string;
};

export type DebateRequest = {
  id: number;
  requester_id?: string;
  requester_handle?: string;
  reason: string;
  status: string;
  created_at: string;
  history?: RequestAction[];
};

export type DebateLink = {
  resolution_id: string;
  stat_title: string;
  stat_status: string;
  vote_total_for: number;
  vote_total_against: number;
  debate_chat_count: number;
};

type Props = {
  entityType: 'bill' | 'proposal' | 'principle';
  entityId: number;
  entityTitle: string;
  entityDescription: string;
  userId: string | null;
  canManage: boolean;
  initialRequests: DebateRequest[];
  debates: DebateLink[];
};

function DebateBadge({ d }: { d: DebateLink }) {
  const isActive = d.stat_status === 'active';
  return (
    <div className={`card-dr px-4 py-3 border ${isActive ? 'border-blue-500/30' : 'border-slate-700/50'}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isActive ? 'text-blue-400' : 'text-slate-500'}`}>
            {isActive ? 'Open Debate' : 'Closed Debate'}
          </p>
          <p className="text-sm text-slate-200">{d.stat_title}</p>
          <div className="flex items-center gap-3 mt-1.5 text-[11px]">
            <span className="text-emerald-400">{d.vote_total_for ?? 0} for</span>
            <span className="text-rose-400">{d.vote_total_against ?? 0} against</span>
            {d.debate_chat_count > 0 && <span className="text-slate-500">{d.debate_chat_count} chat</span>}
          </div>
        </div>
        <Link
          href={`/chamber?resolution=${d.resolution_id}`}
          className="flex-shrink-0 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
        >
          View →
        </Link>
      </div>
    </div>
  );
}

export default function DebateRequestSection({
  entityType, entityId, entityTitle, entityDescription,
  userId, canManage, initialRequests, debates,
}: Props) {
  const router = useRouter();
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');
  const [showForm,     setShowForm]     = useState(false);
  const [reason,       setReason]       = useState('');
  const [rejectingId,  setRejectingId]  = useState<number | null>(null);
  const [rejectNote,   setRejectNote]   = useState('');
  const [movingId,     setMovingId]     = useState<number | null>(null);
  const [debateTitle,  setDebateTitle]  = useState(entityTitle);
  const [debateDesc,   setDebateDesc]   = useState(entityDescription);
  const [showDirect,   setShowDirect]   = useState(false);
  const [directTitle,  setDirectTitle]  = useState(entityTitle);
  const [directDesc,   setDirectDesc]   = useState(entityDescription);

  function refresh() { router.refresh(); setSaving(false); }

  async function submitRequest() {
    if (!reason.trim()) return;
    setSaving(true); setError('');
    const res = await fetch('/api/scotparl/debate-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId, reason }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); setSaving(false); return; }
    setShowForm(false); setReason(''); refresh();
  }

  async function rejectRequest(id: number) {
    setSaving(true); setError('');
    const res = await fetch(`/api/scotparl/debate-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', note: rejectNote }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); setSaving(false); return; }
    setRejectingId(null); setRejectNote(''); refresh();
  }

  async function moveToDebate(id: number) {
    if (!debateTitle.trim() || !debateDesc.trim()) return;
    setSaving(true); setError('');
    const res = await fetch(`/api/scotparl/debate-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move_to_debate', debate_title: debateTitle, debate_description: debateDesc }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); setSaving(false); return; }
    setMovingId(null); refresh();
  }

  async function directOpen() {
    if (!directTitle.trim() || !directDesc.trim()) return;
    setSaving(true); setError('');
    const res = await fetch('/api/scotparl/debates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId, debate_title: directTitle, debate_description: directDesc }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); setSaving(false); return; }
    setShowDirect(false); refresh();
  }

  const hasOpenDebate = debates.some(d => d.stat_status === 'active');
  const myRequests    = userId && !canManage ? initialRequests.filter(r => r.requester_id === userId || !r.requester_id) : [];
  const pendingCount  = initialRequests.filter(r => r.status === 'pending').length;
  const myPending     = myRequests.find(r => r.status === 'pending');

  return (
    <div className="space-y-3">

      {/* Existing debates */}
      {debates.map(d => <DebateBadge key={d.resolution_id} d={d} />)}

      {/* Regular user */}
      {userId && !canManage && !hasOpenDebate && (
        <div className="card-dr px-5 py-4">
          {myPending ? (
            <p className="text-sm text-amber-400">Debate requested — awaiting review.</p>
          ) : myRequests.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Your previous request was {myRequests[0].status}.</p>
              {!showForm && <button onClick={() => setShowForm(true)} className="text-sm text-blue-400 hover:underline">Request again</button>}
            </div>
          ) : !showForm && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 text-sm text-slate-300 hover:text-blue-300 transition-colors">
              <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Request Debate
            </button>
          )}
          {showForm && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Request Debate</p>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} placeholder="Why should this be debated?" className="w-full rounded-lg border border-blue-900/30 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500/50 focus:outline-none resize-y" />
              <div className="flex gap-3">
                <button onClick={submitRequest} disabled={saving || !reason.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors">{saving ? '…' : 'Submit Request'}</button>
                <button onClick={() => { setShowForm(false); setReason(''); }} className="text-sm text-slate-500 hover:text-slate-300">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manager (SysAdmin / CustomerAdmin / TopicOwner) */}
      {canManage && !hasOpenDebate && (
        <div className="card-dr px-5 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Debate Requests{pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
            </p>
            {!showDirect && (
              <button onClick={() => { setShowDirect(true); setDirectTitle(entityTitle); setDirectDesc(entityDescription); }} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                + Open Debate
              </button>
            )}
          </div>

          {showDirect && (
            <div className="space-y-3 border-t border-blue-900/15 pt-3">
              <p className="text-xs font-semibold text-slate-400">Open Debate directly</p>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Title</label>
                <input value={directTitle} onChange={e => setDirectTitle(e.target.value)} className="w-full rounded-lg border border-blue-900/30 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 focus:border-blue-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Description</label>
                <textarea value={directDesc} onChange={e => setDirectDesc(e.target.value)} rows={6} className="w-full rounded-lg border border-blue-900/30 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 focus:border-blue-500/50 focus:outline-none resize-y" />
              </div>
              <div className="flex gap-3">
                <button onClick={directOpen} disabled={saving || !directTitle.trim() || !directDesc.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors">{saving ? '…' : 'Open Debate'}</button>
                <button onClick={() => setShowDirect(false)} className="text-sm text-slate-500 hover:text-slate-300">Cancel</button>
              </div>
            </div>
          )}

          {initialRequests.length === 0 && <p className="text-xs text-slate-600">No requests yet.</p>}

          <div className="space-y-3">
            {initialRequests.map(r => (
              <div key={r.id} className={`rounded-lg border px-4 py-3 space-y-2 ${
                r.status === 'pending' ? 'border-amber-500/20 bg-amber-500/5' :
                r.status === 'moved'   ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-700/40'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-200">@{r.requester_handle}</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    r.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                    r.status === 'moved'   ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/40 text-slate-500'
                  }`}>{r.status}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{r.reason}</p>
                <p className="text-[10px] text-slate-600">{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                {r.history && r.history.length > 0 && (
                  <div className="border-t border-slate-800 pt-2 space-y-1">
                    {r.history.map((h, i) => (
                      <p key={i} className="text-[10px] text-slate-500">
                        {h.action === 'requested' ? 'Requested' :
                         h.action === 'rejected'  ? `Rejected${h.note ? `: ${h.note}` : ''}` :
                         h.action === 'moved_to_debate'
                           ? (h.resolution_id ? <Link href={`/chamber?resolution=${h.resolution_id}`} className="text-blue-400 hover:underline">Moved to debate →</Link> : 'Moved to debate')
                           : h.action}
                        {' '}by @{h.actor_handle} · {new Date(h.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    ))}
                  </div>
                )}
                {r.status === 'pending' && rejectingId !== r.id && movingId !== r.id && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setMovingId(r.id); setDebateTitle(entityTitle); setDebateDesc(entityDescription); }} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 transition-colors">Move to Debate</button>
                    <button onClick={() => { setRejectingId(r.id); setRejectNote(''); }} className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition-colors">Reject</button>
                  </div>
                )}
                {rejectingId === r.id && (
                  <div className="space-y-2 pt-1">
                    <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={2} placeholder="Optional reason…" className="w-full rounded-lg border border-blue-900/30 bg-slate-800/50 px-2 py-1.5 text-xs text-slate-100 focus:outline-none resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => rejectRequest(r.id)} disabled={saving} className="rounded bg-rose-600 px-3 py-1 text-xs text-white hover:bg-rose-500 disabled:opacity-50">{saving ? '…' : 'Confirm'}</button>
                      <button onClick={() => setRejectingId(null)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
                    </div>
                  </div>
                )}
                {movingId === r.id && (
                  <div className="space-y-2 pt-1 border-t border-blue-900/15 mt-2">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Debate Details</p>
                    <input value={debateTitle} onChange={e => setDebateTitle(e.target.value)} className="w-full rounded border border-blue-900/30 bg-slate-800/50 px-2 py-1.5 text-xs text-slate-100 focus:outline-none" />
                    <textarea value={debateDesc} onChange={e => setDebateDesc(e.target.value)} rows={6} className="w-full rounded border border-blue-900/30 bg-slate-800/50 px-2 py-1.5 text-xs text-slate-100 focus:outline-none resize-y" />
                    <div className="flex gap-2">
                      <button onClick={() => moveToDebate(r.id)} disabled={saving || !debateTitle.trim() || !debateDesc.trim()} className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50">{saving ? '…' : 'Open Debate'}</button>
                      <button onClick={() => setMovingId(null)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
