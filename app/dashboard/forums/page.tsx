'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

type Forum = {
  id: string;
  forum_title: string;
  forum_description: string | null;
  forum_type: string;
  forum_visibility: string;
  forum_status: string;
  is_system_forum: boolean;
  created_at: string;
  member_count: number;
  debate_count: number;
};

type FormState = {
  title: string;
  description: string;
  visibility: 'invite' | 'apply';
};

const VIS_LABEL: Record<string, string> = { invite: 'Invite only', apply: 'Apply to join', public: 'Public' };
const VIS_COLOUR: Record<string, string> = {
  invite: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  apply:  'bg-amber-500/15 text-amber-300 border-amber-500/30',
  public: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

function ForumIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </svg>
  );
}

export default function ForumsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [forums,    setForums]    = useState<Forum[]>([]);
  const [fetching,  setFetching]  = useState(true);
  const [error,     setError]     = useState('');
  const [editId,    setEditId]    = useState<string | null>(null);
  const [creating,  setCreating]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [formErr,   setFormErr]   = useState('');
  const [form,      setForm]      = useState<FormState>({ title: '', description: '', visibility: 'invite' });

  // Invite flow state
  const [invitingId,       setInvitingId]       = useState<string | null>(null);
  const [inviteMessage,    setInviteMessage]     = useState('');
  const [generatedLink,    setGeneratedLink]     = useState<string | null>(null);
  const [inviteGenerating, setInviteGenerating] = useState(false);
  const [inviteErr,        setInviteErr]         = useState('');
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/forums');
    if (!loading && user && user.tier === 'follower') router.push('/dashboard');
  }, [loading, user, router]);

  const loadForums = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/forums');
      if (!res.ok) throw new Error('Failed to load forums');
      setForums(await res.json());
    } catch {
      setError('Could not load forums');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { if (user) loadForums(); }, [user, loadForums]);

  function openCreate() {
    setForm({ title: '', description: '', visibility: 'invite' });
    setFormErr(''); setEditId(null); setCreating(true);
  }

  function openEdit(f: Forum) {
    setForm({
      title: f.forum_title,
      description: f.forum_description ?? '',
      visibility: (f.forum_visibility as 'invite' | 'apply') ?? 'invite',
    });
    setFormErr(''); setCreating(false); setEditId(f.id);
  }

  function closeForm() { setCreating(false); setEditId(null); setFormErr(''); }

  function openInvite(forumId: string) {
    setInvitingId(forumId);
    setInviteMessage('');
    setGeneratedLink(null);
    setInviteErr('');
    setInviteLinkCopied(false);
  }
  function closeInvite() { setInvitingId(null); setGeneratedLink(null); }

  async function generateInvite() {
    if (!invitingId) return;
    setInviteGenerating(true); setInviteErr('');
    try {
      const res = await fetch(`/api/forums/${invitingId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inviteMessage || null }),
      });
      const data = await res.json();
      if (!res.ok) { setInviteErr(data.error ?? 'Failed to generate link'); return; }
      setGeneratedLink(data.url);
    } catch {
      setInviteErr('Network error');
    } finally {
      setInviteGenerating(false);
    }
  }

  function copyInviteLink() {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink).then(() => {
      setInviteLinkCopied(true);
      setTimeout(() => setInviteLinkCopied(false), 2000);
    });
  }

  async function handleSave() {
    if (!form.title.trim()) { setFormErr('Title is required'); return; }
    setSaving(true); setFormErr('');
    try {
      const url  = editId ? `/api/forums/${editId}` : '/api/forums';
      const method = editId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, description: form.description || null, visibility: form.visibility }),
      });
      const data = await res.json();
      if (!res.ok) { setFormErr(data.error ?? 'Save failed'); return; }
      await loadForums();
      closeForm();
    } catch {
      setFormErr('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(f: Forum) {
    if (!window.confirm(`Delete "${f.forum_title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/forums/${f.id}`, { method: 'DELETE' });
    if (res.ok) await loadForums();
    else { const d = await res.json(); alert(d.error ?? 'Delete failed'); }
  }

  if (loading || !user) return null;

  const isPaid = user.plan === 'paid' || user.isSysAdmin;
  const systemForum = forums.find(f => f.is_system_forum);
  const additionalForums = forums.filter(f => !f.is_system_forum);

  return (
    <div className="px-6 py-8 max-w-3xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">My Forums</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your private debate forums and their members
          </p>
        </div>
        {isPaid && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors flex-shrink-0"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Forum
          </button>
        )}
      </div>

      {/* Create / Edit form */}
      {(creating || editId) && (
        <div className="mb-6 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">
            {creating ? 'Create New Forum' : 'Edit Forum'}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Forum title…"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Description <span className="text-slate-600">(optional)</span></label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="What is this forum about?"
                rows={2}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none resize-none"
              />
            </div>
            {/* Visibility locked for system forums */}
            {!(editId && forums.find(f => f.id === editId)?.is_system_forum) && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Visibility</label>
                <div className="flex gap-2">
                  {(['invite', 'apply'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setForm(p => ({ ...p, visibility: v }))}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        form.visibility === v
                          ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {v === 'invite' ? 'Invite only' : 'Apply to join'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-600 mt-1.5">
                  {form.visibility === 'invite'
                    ? 'Debates are hidden — you invite members via a magic link.'
                    : 'Debates are visible in the Switchboard — anyone can apply to join.'}
                </p>
              </div>
            )}
            {editId && forums.find(f => f.id === editId)?.is_system_forum && (
              <p className="text-xs text-slate-600">
                Your personal forum is always Invite only — visibility cannot be changed.
              </p>
            )}
          </div>
          {formErr && <p className="mt-2 text-xs text-red-400">{formErr}</p>}
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={closeForm} className="rounded-lg px-4 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {fetching ? (
        <div className="py-16 text-center text-slate-500 text-sm">Loading…</div>
      ) : (
        <div className="space-y-3">
          {/* System forum */}
          {systemForum && (
            <>
              <ForumCard
                forum={systemForum}
                onEdit={() => openEdit(systemForum)}
                onDelete={() => {}}
                onInvite={() => openInvite(systemForum.id)}
                isEditing={editId === systemForum.id}
                isInviting={invitingId === systemForum.id}
              />
              {invitingId === systemForum.id && (
                <InvitePanel
                  message={inviteMessage}
                  onMessageChange={setInviteMessage}
                  onGenerate={generateInvite}
                  onClose={closeInvite}
                  onCopy={copyInviteLink}
                  generating={inviteGenerating}
                  link={generatedLink}
                  copied={inviteLinkCopied}
                  error={inviteErr}
                />
              )}
            </>
          )}

          {/* Additional forums */}
          {additionalForums.map(f => (
            <div key={f.id}>
              <ForumCard
                forum={f}
                onEdit={() => openEdit(f)}
                onDelete={() => handleDelete(f)}
                onInvite={() => openInvite(f.id)}
                isEditing={editId === f.id}
                isInviting={invitingId === f.id}
              />
              {invitingId === f.id && (
                <InvitePanel
                  message={inviteMessage}
                  onMessageChange={setInviteMessage}
                  onGenerate={generateInvite}
                  onClose={closeInvite}
                  onCopy={copyInviteLink}
                  generating={inviteGenerating}
                  link={generatedLink}
                  copied={inviteLinkCopied}
                  error={inviteErr}
                />
              )}
            </div>
          ))}

          {/* Upsell for free users */}
          {!isPaid && (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-[#0c1322] p-5 flex items-start gap-4">
              <div className="flex-shrink-0 h-9 w-9 rounded-full bg-blue-500/10 flex items-center justify-center">
                <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">Create additional forums with a Paid plan</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upgrade to create unlimited private forums with Apply or Invite visibility, and participate in all public debates.
                </p>
                <a href="/pricing" className="inline-block mt-2 text-xs font-semibold text-blue-400 hover:text-blue-300">
                  See plans →
                </a>
              </div>
            </div>
          )}

          {forums.length === 0 && !fetching && (
            <div className="py-16 text-center text-slate-500 text-sm">No forums found.</div>
          )}
        </div>
      )}
    </div>
  );
}

function ForumCard({
  forum, onEdit, onDelete, onInvite, isEditing, isInviting,
}: {
  forum: Forum;
  onEdit: () => void;
  onDelete: () => void;
  onInvite: () => void;
  isEditing: boolean;
  isInviting: boolean;
}) {
  const borderClass = isEditing
    ? 'border-blue-500/40'
    : isInviting
    ? 'border-violet-500/40'
    : 'border-slate-800';

  return (
    <div className={`rounded-2xl border bg-[#0c1322] p-5 transition-colors ${borderClass}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center">
          <ForumIcon className="h-4.5 w-4.5 text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-100 truncate">{forum.forum_title}</h3>
            {forum.is_system_forum && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">Personal</span>
            )}
            <span className={`text-[10px] font-bold uppercase tracking-wider border rounded px-1.5 py-0.5 ${VIS_COLOUR[forum.forum_visibility] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
              {VIS_LABEL[forum.forum_visibility] ?? forum.forum_visibility}
            </span>
          </div>
          {forum.forum_description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{forum.forum_description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-600">
            <span>{forum.member_count} member{forum.member_count !== 1 ? 's' : ''}</span>
            <span>{forum.debate_count} debate{forum.debate_count !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Invite button — only for invite-visibility forums */}
          {forum.forum_visibility === 'invite' && (
            <button
              onClick={onInvite}
              className={`rounded-lg p-1.5 transition-colors ${isInviting ? 'text-violet-400 bg-violet-500/10' : 'text-slate-500 hover:text-violet-400 hover:bg-violet-500/10'}`}
              title="Generate invite link"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
              </svg>
            </button>
          )}
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Edit forum"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
            </svg>
          </button>
          {!forum.is_system_forum && (
            <button
              onClick={onDelete}
              className="rounded-lg p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Delete forum"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InvitePanel({
  message, onMessageChange, onGenerate, onClose, onCopy,
  generating, link, copied, error,
}: {
  message: string;
  onMessageChange: (v: string) => void;
  onGenerate: () => void;
  onClose: () => void;
  onCopy: () => void;
  generating: boolean;
  link: string | null;
  copied: boolean;
  error: string;
}) {
  return (
    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-5 -mt-1">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">Generate invite link</h3>
      {!link ? (
        <>
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Message <span className="text-slate-600">(optional — shown on invitation page)</span>
            </label>
            <textarea
              value={message}
              onChange={e => onMessageChange(e.target.value)}
              placeholder="e.g. Hi! I'd love you to join our debate forum on…"
              rows={2}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-violet-500 focus:outline-none resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={onGenerate}
              disabled={generating}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
            >
              {generating ? 'Generating…' : 'Generate link'}
            </button>
            <button onClick={onClose} className="rounded-lg px-4 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-slate-500 mb-2">
            Copy and share this link. It expires once accepted.
          </p>
          <button
            onClick={onCopy}
            className="w-full flex items-center gap-3 rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 hover:border-violet-500/40 transition-colors group text-left"
          >
            <span className="flex-1 font-mono text-xs text-violet-300 break-all">{link}</span>
            <span className="flex-shrink-0 text-xs text-slate-500 group-hover:text-slate-300">
              {copied ? (
                <span className="text-emerald-400">Copied!</span>
              ) : 'Copy'}
            </span>
          </button>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onGenerate}
              disabled={generating}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Generate another
            </button>
            <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}
