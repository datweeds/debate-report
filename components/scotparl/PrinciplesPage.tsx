'use client';

import { useEffect, useState, useCallback } from 'react';
import DebateRequestSection, { type DebateRequest, type DebateLink } from './DebateRequestSection';
import VoteSection, { type PollInfo } from './VoteSection';

type ReviewRequest = {
  id: number;
  principle_id: number;
  user_id: string;
  user_handle: string;
  request_text: string;
  status: 'pending' | 'under_review';
  created_at: string;
};

type Principle = {
  id: number;
  set_id: number;
  sort_order: number;
  title: string;
  body: string;
  grounding: string;
  review_requests: ReviewRequest[];
  debates: DebateLink[];
  debate_requests: DebateRequest[];
  pvc_poll_id: string | null;
  poll: PollInfo | null;
};

type PrincipleSet = {
  id: number;
  version: number;
  description: string | null;
  is_current: boolean;
  created_at: string;
  principles: Principle[];
};

type Topic = {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
  current_set: PrincipleSet | null;
  all_sets: Omit<PrincipleSet, 'principles'>[];
};

type PageData = { topics: Topic[] };

type Props = {
  userId: string | null;
  userHandle: string | null;
  isSysAdmin: boolean;
  canManage: boolean;
  siteName?: string | null;
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const BLANK_FORM = { title: '', body: '', grounding: '' };
const BLANK_TOPIC = { name: '', description: '' };

export default function PrinciplesPage({ userId, isSysAdmin, canManage, siteName }: Props) {
  const [data, setData] = useState<PageData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [activeTopicId, setActiveTopicId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Topic management
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTopicForm, setNewTopicForm] = useState(BLANK_TOPIC);
  const [editingTopicId, setEditingTopicId] = useState<number | null>(null);
  const [editTopicForm, setEditTopicForm] = useState(BLANK_TOPIC);

  // New version modal
  const [showNewSet, setShowNewSet] = useState(false);
  const [newSetDesc, setNewSetDesc] = useState('');

  // Principle editing
  const [editingPrincipleId, setEditingPrincipleId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(BLANK_FORM);

  // Add principle
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(BLANK_FORM);

  // Review request
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/scotparl/nsp');
      const json: PageData = await res.json();
      setData(json);
      setActiveTopicId(prev => {
        if (prev && json.topics.find(t => t.id === prev)) return prev;
        return json.topics[0]?.id ?? null;
      });
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data && !loadError) return <div className="py-16 text-center text-slate-500 text-sm">Loading…</div>;
  if (loadError || !data) return <div className="py-16 text-center text-slate-500 text-sm">Failed to load principles.</div>;

  const activeTopic = data.topics.find(t => t.id === activeTopicId) ?? null;
  const canReview = !!userId && !isSysAdmin;

  async function api(url: string, opts: RequestInit) {
    setSaving(true);
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } finally {
      setSaving(false);
    }
  }

  // Topic actions
  async function createTopic() {
    if (!newTopicForm.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/scotparl/nsp/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTopicForm),
      });
      const { id } = await res.json();
      await load();
      setActiveTopicId(id);
    } finally {
      setSaving(false);
    }
    setNewTopicForm(BLANK_TOPIC);
    setShowNewTopic(false);
  }

  async function saveTopic(id: number) {
    await api(`/api/scotparl/nsp/topics/${id}`, { method: 'PUT', body: JSON.stringify(editTopicForm) });
    setEditingTopicId(null);
  }

  async function deleteTopic(id: number, name: string) {
    if (!confirm(`Delete the "${name}" topic and all its principles? This cannot be undone.`)) return;
    await api(`/api/scotparl/nsp/topics/${id}`, { method: 'DELETE' });
    setActiveTopicId(data?.topics.find(t => t.id !== id)?.id ?? null);
  }

  // Set / version actions
  async function createSet() {
    if (!activeTopic) return;
    await api(`/api/scotparl/nsp/topics/${activeTopic.id}/sets`, {
      method: 'POST',
      body: JSON.stringify({ description: newSetDesc }),
    });
    setNewSetDesc('');
    setShowNewSet(false);
  }

  // Principle actions
  async function addPrinciple() {
    if (!activeTopic || !addForm.title.trim() || !addForm.body.trim()) return;
    await api(`/api/scotparl/nsp/topics/${activeTopic.id}/principles`, {
      method: 'POST',
      body: JSON.stringify(addForm),
    });
    setAddForm(BLANK_FORM);
    setShowAddForm(false);
  }

  async function savePrinciple(id: number) {
    await api(`/api/scotparl/nsp/principles/${id}`, { method: 'PUT', body: JSON.stringify(editForm) });
    setEditingPrincipleId(null);
  }

  async function deletePrinciple(id: number) {
    if (!confirm('Delete this principle?')) return;
    await api(`/api/scotparl/nsp/principles/${id}`, { method: 'DELETE' });
  }

  async function submitReview(principleId: number) {
    if (!reviewText.trim()) return;
    await api(`/api/scotparl/nsp/principles/${principleId}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ request_text: reviewText }),
    });
    setReviewText('');
    setReviewingId(null);
  }

  async function markUnderReview(requestId: number) {
    await api(`/api/scotparl/nsp/review-requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'under_review' }),
    });
  }

  const nextVersion = (activeTopic?.current_set?.version ?? 0) + 1;

  return (
    <div className="space-y-6">

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">{siteName ? `${siteName} Principles` : 'Principles'}</h1>
        <p className="text-slate-400 text-sm mt-1">
          Principles that guide proposals and legislative priorities, grouped by topic.
        </p>
      </div>

      {/* ── Topic selector ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={activeTopicId ?? ''}
          onChange={e => {
            const id = Number(e.target.value) || null;
            setActiveTopicId(id);
            setEditingPrincipleId(null);
            setShowAddForm(false);
            setShowNewSet(false);
          }}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-slate-500"
        >
          {data.topics.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}{t.current_set ? ` (v${t.current_set.version})` : ''}
            </option>
          ))}
        </select>
        {isSysAdmin && (
          <button
            onClick={() => setShowNewTopic(true)}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-blue-400 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Topic
          </button>
        )}
      </div>

      {/* No topics yet */}
      {data.topics.length === 0 && (
        <div className="card-dr py-16 text-center space-y-2">
          <p className="text-slate-400">No topics created yet.</p>
          {isSysAdmin && (
            <p className="text-sm text-slate-500">Use <span className="text-blue-400">New Topic</span> above to get started.</p>
          )}
        </div>
      )}

      {/* ── New Topic modal ── */}
      {showNewTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="card-dr w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-100">New Topic</h2>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Topic name</label>
              <input
                value={newTopicForm.name}
                onChange={e => setNewTopicForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Food, Technology, Housing…"
                autoFocus
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Description <span className="text-slate-600">(optional)</span></label>
              <textarea
                value={newTopicForm.description}
                onChange={e => setNewTopicForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="What area of society does this topic cover?"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowNewTopic(false); setNewTopicForm(BLANK_TOPIC); }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createTopic}
                disabled={saving || !newTopicForm.name.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
              >
                {saving ? 'Creating…' : 'Create Topic'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active topic content ── */}
      {activeTopic && (
        <>
          {/* Topic header */}
          {editingTopicId === activeTopic.id ? (
            <div className="card-dr p-5 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Edit Topic</p>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Name</label>
                <input
                  value={editTopicForm.name}
                  onChange={e => setEditTopicForm(f => ({ ...f, name: e.target.value }))}
                  autoFocus
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Description</label>
                <textarea
                  value={editTopicForm.description}
                  onChange={e => setEditTopicForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingTopicId(null)} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
                <button onClick={() => saveTopic(activeTopic.id)} disabled={saving} className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                {activeTopic.description && (
                  <p className="text-sm text-slate-400 leading-relaxed">{activeTopic.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isSysAdmin && (
                  <>
                    <button
                      onClick={() => {
                        setEditingTopicId(activeTopic.id);
                        setEditTopicForm({ name: activeTopic.name, description: activeTopic.description ?? '' });
                      }}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Edit topic
                    </button>
                    <span className="text-slate-700">·</span>
                    <button
                      onClick={() => deleteTopic(activeTopic.id, activeTopic.name)}
                      className="text-xs text-rose-600 hover:text-rose-400 transition-colors"
                    >
                      Delete topic
                    </button>
                    <span className="text-slate-700">·</span>
                    <button
                      onClick={() => setShowNewSet(true)}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      New version
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* New Version modal */}
          {showNewSet && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
              <div className="card-dr w-full max-w-lg p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">{activeTopic.name} — Version {nextVersion}</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    All current principles will be copied into the new version. You can edit them from there.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    What changed from v{activeTopic.current_set?.version ?? '—'}?
                  </label>
                  <textarea
                    value={newSetDesc}
                    onChange={e => setNewSetDesc(e.target.value)}
                    rows={4}
                    autoFocus
                    placeholder="Describe the changes introduced in this version…"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setShowNewSet(false); setNewSetDesc(''); }} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
                  <button onClick={createSet} disabled={saving || !newSetDesc.trim()} className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors">
                    {saving ? 'Creating…' : `Create v${nextVersion}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Version / change description */}
          {activeTopic.current_set?.description && (
            <div className="rounded-xl border border-blue-800/20 bg-blue-500/5 px-5 py-4">
              <p className="text-xs font-semibold text-blue-400 mb-1.5 uppercase tracking-wide">
                Changes in v{activeTopic.current_set.version}
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">{activeTopic.current_set.description}</p>
            </div>
          )}

          {/* Principles */}
          {!activeTopic.current_set ? (
            <div className="card-dr py-10 text-center text-slate-500 text-sm">
              No principle set for this topic yet.
            </div>
          ) : (
            <div className="space-y-5">
              {activeTopic.current_set.principles.length === 0 && (
                <div className="card-dr py-10 text-center text-slate-500 text-sm">
                  No principles in this set yet.
                  {isSysAdmin && <span className="block mt-1">Use "Add Principle" below to get started.</span>}
                </div>
              )}

              {activeTopic.current_set.principles.map((p, idx) => (
                <div key={p.id} className="card-dr overflow-hidden">
                  {editingPrincipleId === p.id ? (
                    <div className="p-5 space-y-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Editing principle {idx + 1}</p>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Title</label>
                        <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Definition</label>
                        <textarea value={editForm.body} onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))} rows={5}
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none resize-y" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Grounding</label>
                        <textarea value={editForm.grounding} onChange={e => setEditForm(f => ({ ...f, grounding: e.target.value }))} rows={2}
                          placeholder="e.g. Article 8, European Convention on Human Rights"
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none" />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingPrincipleId(null)} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
                        <button onClick={() => savePrinciple(p.id)} disabled={saving}
                          className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors">
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="px-5 pt-5 pb-4">
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 mt-0.5 text-sm font-bold text-slate-600 w-6 text-right">{idx + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="text-base font-semibold text-slate-100 leading-snug">{p.title}</h3>
                              {isSysAdmin && (
                                <div className="flex items-center gap-1 flex-shrink-0 -mt-0.5">
                                  <button
                                    onClick={() => { setEditingPrincipleId(p.id); setEditForm({ title: p.title, body: p.body, grounding: p.grounding }); }}
                                    className="rounded px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                                  >Edit</button>
                                  <button onClick={() => deletePrinciple(p.id)}
                                    className="rounded px-2 py-1 text-xs text-rose-500/80 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                  >Delete</button>
                                </div>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{p.body}</p>
                            {p.grounding && (
                              <p className="mt-3 text-xs text-slate-500 italic leading-relaxed">Grounded in: {p.grounding}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Review requests */}
                      <div className="border-t border-slate-800/80 bg-slate-900/30 px-5 py-4 space-y-4">
                        {p.review_requests.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                              Review Requests ({p.review_requests.length})
                            </p>
                            {p.review_requests.map(r => (
                              <div key={r.id} className="rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-3 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-slate-300">{r.user_handle}</span>
                                  <span className="text-xs text-slate-600">{fmtDate(r.created_at)}</span>
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${
                                    r.status === 'under_review'
                                      ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  }`}>
                                    {r.status === 'under_review' ? 'Under Review' : 'Pending'}
                                  </span>
                                  {isSysAdmin && r.status === 'pending' && (
                                    <button onClick={() => markUnderReview(r.id)}
                                      className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">
                                      Mark Under Review
                                    </button>
                                  )}
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">{r.request_text}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {canReview && (
                          reviewingId === p.id ? (
                            <div className="space-y-2">
                              <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} rows={3} autoFocus
                                placeholder="Explain why you're requesting a review of this principle…"
                                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:outline-none resize-none" />
                              <div className="flex justify-end gap-2">
                                <button onClick={() => { setReviewingId(null); setReviewText(''); }}
                                  className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
                                <button onClick={() => submitReview(p.id)} disabled={saving || !reviewText.trim()}
                                  className="px-4 py-1.5 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors">
                                  {saving ? 'Submitting…' : 'Submit Request'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => { setReviewingId(p.id); setReviewText(''); }}
                              className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                              + Request a Review
                            </button>
                          )
                        )}

                        {!userId && (
                          <p className="text-xs text-slate-600">Log in to submit a review request.</p>
                        )}
                      </div>

                      {/* Debate section */}
                      <div className="border-t border-slate-800/80 bg-slate-900/30 px-5 py-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Debate</p>
                        {(userId || p.debates.length > 0 || canManage) ? (
                          <DebateRequestSection
                            entityType="principle"
                            entityId={p.id}
                            entityTitle={p.title}
                            entityDescription={p.body}
                            userId={userId}
                            canManage={canManage}
                            initialRequests={p.debate_requests}
                            debates={p.debates}
                          />
                        ) : (
                          <p className="text-xs text-slate-600">Log in to request a debate.</p>
                        )}
                      </div>

                      {/* Vote section */}
                      {(p.poll || canManage) && (
                        <div className="border-t border-slate-800/80 bg-slate-900/30 px-5 py-4">
                          <VoteSection
                            poll={p.poll}
                            entityType="principle"
                            entityId={p.id}
                            canManage={canManage}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Principle (admin) */}
          {isSysAdmin && activeTopic.current_set && (
            showAddForm ? (
              <div className="card-dr p-5 space-y-4">
                <p className="text-sm font-semibold text-slate-200">Add Principle</p>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Title</label>
                  <input value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Short, clear principle title" autoFocus
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Definition</label>
                  <textarea value={addForm.body} onChange={e => setAddForm(f => ({ ...f, body: e.target.value }))} rows={5}
                    placeholder="Full definition and explanation of the principle…"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-y" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Grounding</label>
                  <textarea value={addForm.grounding} onChange={e => setAddForm(f => ({ ...f, grounding: e.target.value }))} rows={2}
                    placeholder="e.g. Article 8, European Convention on Human Rights; UNCRC Article 24"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none" />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setShowAddForm(false); setAddForm(BLANK_FORM); }}
                    className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
                  <button onClick={addPrinciple} disabled={saving || !addForm.title.trim() || !addForm.body.trim()}
                    className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors">
                    {saving ? 'Adding…' : 'Add Principle'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddForm(true)}
                className="flex items-center justify-center gap-2 w-full rounded-xl border border-dashed border-slate-700 px-4 py-3.5 text-sm text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Principle
              </button>
            )
          )}

          {/* Version history */}
          {activeTopic.all_sets.length > 1 && (
            <details className="rounded-xl border border-slate-800">
              <summary className="px-5 py-4 text-sm text-slate-500 cursor-pointer hover:text-slate-300 transition-colors select-none list-none flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Version history ({activeTopic.all_sets.length} sets)
              </summary>
              <div className="divide-y divide-slate-800/60 border-t border-slate-800">
                {activeTopic.all_sets.map(s => (
                  <div key={s.id} className="px-5 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-300">v{s.version}</span>
                      {s.is_current && <span className="rounded-full bg-blue-500/10 text-blue-300 text-xs px-2 py-0.5 border border-blue-500/20">Current</span>}
                      <span className="text-xs text-slate-600">{fmtDate(s.created_at)}</span>
                    </div>
                    {s.description && <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{s.description}</p>}
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
