'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type Party = {
  id: string;
  name: string;
  max_users: number;
  created_at: string;
  revoked_at: string | null;
  registered_users: number;
};

type PartyUser = {
  external_user_id: string;
  created_at: string;
  user_id: string;
  user_handle: string;
  user_full_name: string | null;
  statement_count: number;
};

type PrivateDebate = {
  id: string;
  title: string;
  visibility: 'apply' | 'invite';
  society: string | null;
  granted: boolean;
};

export default function ApiPartiesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [parties, setParties]       = useState<Party[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [showNew, setShowNew]       = useState(false);
  const [name, setName]             = useState('');
  const [maxUsers, setMaxUsers]     = useState('10');
  const [creating, setCreating]     = useState(false);
  const [newToken, setNewToken]     = useState<string | null>(null);
  const [error, setError]          = useState('');

  const [expanded, setExpanded]     = useState<string | null>(null);
  const [partyUsers, setPartyUsers] = useState<Record<string, PartyUser[]>>({});
  const [partyDebates, setPartyDebates] = useState<Record<string, PrivateDebate[]>>({});
  const [debatesSaving, setDebatesSaving] = useState<string | null>(null);
  const [debatesSaved, setDebatesSaved]   = useState<string | null>(null);
  const [debatesError, setDebatesError]   = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/api-parties');
    if (!loading && user && !user.isSysAdmin) router.push('/dashboard');
  }, [loading, user, router]);

  const load = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch('/api/admin/api-parties');
      const d = await res.json();
      setParties(d.parties ?? []);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { if (user?.isSysAdmin) load(); }, [user, load]);

  const createParty = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/admin/api-parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, max_users: Number(maxUsers) }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'Could not create party'); return; }
      setNewToken(d.token);
      setName('');
      setMaxUsers('10');
      load();
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string, revoked: boolean) => {
    if (revoked && !confirm('Revoke this token? The party will immediately lose API access.')) return;
    await fetch(`/api/admin/api-parties/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revoked }),
    });
    load();
  };

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!partyUsers[id]) {
      const res = await fetch(`/api/admin/api-parties/${id}/users`);
      const d = await res.json();
      setPartyUsers(prev => ({ ...prev, [id]: d.users ?? [] }));
    }
    if (!partyDebates[id]) {
      const res = await fetch(`/api/admin/api-parties/${id}/debates`);
      const d = await res.json();
      setPartyDebates(prev => ({ ...prev, [id]: d.debates ?? [] }));
    }
  };

  const toggleDebate = (partyId: string, debateId: string) => {
    setDebatesSaved(null);
    setPartyDebates(prev => ({
      ...prev,
      [partyId]: prev[partyId].map(d => d.id === debateId ? { ...d, granted: !d.granted } : d),
    }));
  };

  const saveDebates = async (partyId: string) => {
    setDebatesSaving(partyId); setDebatesError('');
    try {
      const res = await fetch(`/api/admin/api-parties/${partyId}/debates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionIds: partyDebates[partyId].filter(d => d.granted).map(d => d.id) }),
      });
      if (!res.ok) { setDebatesError((await res.json()).error ?? 'Could not save'); return; }
      setDebatesSaved(partyId);
      setTimeout(() => setDebatesSaved(s => (s === partyId ? null : s)), 3000);
    } finally {
      setDebatesSaving(null);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="px-8 py-10 max-w-3xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">API Parties</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tokens for external platforms that create statements on behalf of their own users.
          </p>
        </div>
        <button
          onClick={() => { setShowNew(true); setNewToken(null); setError(''); }}
          className="rounded-lg bg-lime-500/15 border border-lime-700/40 text-lime-300 px-4 py-2 text-sm font-medium hover:bg-lime-500/25 transition-colors whitespace-nowrap"
        >
          + New party
        </button>
      </div>

      {listLoading ? (
        <div className="space-y-2">
          {[0, 1].map(i => <div key={i} className="h-16 rounded-xl bg-slate-800/40 animate-pulse" />)}
        </div>
      ) : parties.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-10 text-center">
          <p className="text-sm text-slate-400 font-medium">No parties yet</p>
          <p className="text-xs text-slate-600 mt-1">Create one to issue an API token.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {parties.map(p => (
            <div key={p.id} className="rounded-xl border border-slate-800 bg-[#0c1322] overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-4">
                <button onClick={() => toggleExpand(p.id)} className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200 truncate">{p.name}</span>
                    {p.revoked_at && (
                      <span className="rounded-full bg-rose-500/15 text-rose-300 border border-rose-700/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        Revoked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {p.registered_users} / {p.max_users} users registered · created {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </button>
                <button
                  onClick={() => revoke(p.id, !p.revoked_at)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border whitespace-nowrap transition-colors ${
                    p.revoked_at
                      ? 'border-emerald-700/40 text-emerald-300 hover:bg-emerald-500/10'
                      : 'border-rose-700/40 text-rose-300 hover:bg-rose-500/10'
                  }`}
                >
                  {p.revoked_at ? 'Un-revoke' : 'Revoke'}
                </button>
              </div>

              {expanded === p.id && (
                <div className="border-t border-slate-800 bg-[#080d1a] px-4 py-3">
                  {!partyUsers[p.id] ? (
                    <p className="text-xs text-slate-600">Loading…</p>
                  ) : partyUsers[p.id].length === 0 ? (
                    <p className="text-xs text-slate-600 italic">No users registered yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {partyUsers[p.id].map(u => (
                        <div key={u.external_user_id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">
                            <span className="text-slate-300">{u.user_full_name || `@${u.user_handle}`}</span>
                            {' '}<span className="text-slate-600">(external id: {u.external_user_id})</span>
                          </span>
                          <span className="text-slate-600">{u.statement_count} statement{u.statement_count === 1 ? '' : 's'}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 border-t border-slate-800 pt-3">
                    <p className="text-xs font-semibold text-slate-300">Private debates</p>
                    <p className="text-xs text-slate-600 mt-0.5 mb-2">
                      Public debates are always open to this token. Tick the Apply/Invite debates it may also read and write.
                    </p>
                    {!partyDebates[p.id] ? (
                      <p className="text-xs text-slate-600">Loading…</p>
                    ) : partyDebates[p.id].length === 0 ? (
                      <p className="text-xs text-slate-600 italic">There are no private debates.</p>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          {partyDebates[p.id].map(d => (
                            <label key={d.id} className="flex items-start gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={d.granted}
                                onChange={() => toggleDebate(p.id, d.id)}
                                className="mt-0.5 accent-lime-500"
                              />
                              <span className="text-slate-300">
                                {d.title}
                                <span className="text-slate-600"> · {d.visibility === 'invite' ? 'Invite' : 'Apply'}{d.society ? ` · ${d.society}` : ''}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <button
                            onClick={() => saveDebates(p.id)}
                            disabled={debatesSaving === p.id}
                            className="rounded-lg bg-lime-500/15 border border-lime-700/40 text-lime-300 px-3 py-1.5 text-xs font-medium hover:bg-lime-500/25 transition-colors disabled:opacity-50"
                          >
                            {debatesSaving === p.id ? 'Saving…' : 'Save access'}
                          </button>
                          {debatesSaved === p.id && <span className="text-xs text-emerald-400">✓ Saved</span>}
                          {debatesError && expanded === p.id && <span className="text-xs text-rose-400">{debatesError}</span>}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowNew(false)}>
          <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            {newToken ? (
              <>
                <h2 className="text-sm font-semibold text-slate-200 mb-2">Token created</h2>
                <p className="text-xs text-amber-300 mb-3">This is shown once — copy it now. It can't be retrieved again (you'd need to revoke and issue a new one).</p>
                <div className="rounded-lg bg-slate-900 border border-slate-700 p-3 font-mono text-xs text-lime-300 break-all mb-4 select-all">
                  {newToken}
                </div>
                <button
                  onClick={() => { setShowNew(false); setNewToken(null); }}
                  className="w-full rounded-lg bg-slate-800 text-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-700 transition-colors"
                >
                  Done
                </button>
              </>
            ) : (
              <form onSubmit={createParty}>
                <h2 className="text-sm font-semibold text-slate-200 mb-4">New API party</h2>
                <label className="block text-xs text-slate-500 mb-1">Party name</label>
                <input
                  value={name} onChange={e => setName(e.target.value)} autoFocus required
                  placeholder="e.g. Acme Social Network"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 text-sm mb-4 outline-none focus:border-lime-600"
                />
                <label className="block text-xs text-slate-500 mb-1">Max participating users</label>
                <input
                  type="number" min={1} max={1000} value={maxUsers} onChange={e => setMaxUsers(e.target.value)} required
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 text-sm mb-4 outline-none focus:border-lime-600"
                />
                {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowNew(false)} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={creating || !name.trim()} className="rounded-lg bg-lime-500/15 border border-lime-700/40 text-lime-300 px-4 py-2 text-sm font-medium hover:bg-lime-500/25 transition-colors disabled:opacity-50">
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
