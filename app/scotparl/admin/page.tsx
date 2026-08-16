'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OwnedTopic { id: number; name: string; strapline: string | null; }
interface MeData { isCustomerAdmin: boolean; isTopicOwner: boolean; ownedTopics: OwnedTopic[]; }
interface Topic { id: number; name: string; description: string | null; sort_order: number; }
interface Counts {
  proposals_total: number; proposals_pending: number;
  proposals_accepted: number; proposals_rejected: number;
  debates_total: number; votes_total: number;
  topics_total?: number; topic_owners_total?: number;
}
interface RecentProposal { id: number; title: string; status: string; updated_at: string; topic_name: string | null; }
interface TopicOwnerRow { user_id: string; handle: string; topics: { id: number; name: string }[]; }
interface SiteConfig { name: string; hero_text: string; hero_image: string; contact_email: string; }

const STATUS_BADGE: Record<string, string> = {
  proposed: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  amended:  'bg-violet-500/10 text-violet-300 border-violet-500/20',
  accepted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Spinner() {
  return <div className="flex justify-center py-10"><div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>;
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ me, allTopics }: { me: MeData; allTopics: Topic[] }) {
  const visibleTopics = me.isCustomerAdmin
    ? allTopics
    : allTopics.filter(t => me.ownedTopics.some(o => o.id === t.id));

  const defaultTopic: number | '' = me.isCustomerAdmin ? '' : (visibleTopics[0]?.id ?? '');
  const [topicId, setTopicId] = useState<number | ''>(defaultTopic);
  const [counts, setCounts]   = useState<Counts | null>(null);
  const [recent, setRecent]   = useState<RecentProposal[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (tid: number | '') => {
    setLoading(true);
    try {
      const url = tid ? `/api/scotparl/admin/stats?topic_id=${tid}` : '/api/scotparl/admin/stats';
      const r = await fetch(url);
      if (!r.ok) return;
      const d = await r.json();
      setCounts(d.counts);
      setRecent(d.recent ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(defaultTopic); }, []);

  function handleTopicChange(val: number | '') {
    setTopicId(val);
    load(val);
  }

  const ownedStrapline = (!me.isCustomerAdmin && topicId)
    ? me.ownedTopics.find(o => o.id === topicId)?.strapline
    : null;

  return (
    <div className="space-y-6">
      {visibleTopics.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {me.isCustomerAdmin && (
            <button
              onClick={() => handleTopicChange('')}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${!topicId ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
            >
              All
            </button>
          )}
          {visibleTopics.map(t => (
            <button
              key={t.id}
              onClick={() => handleTopicChange(t.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${topicId === t.id ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {ownedStrapline && (
        <div className="rounded-xl border border-blue-800/30 bg-blue-500/5 px-4 py-3 text-sm text-blue-200/80 italic">
          {ownedStrapline}
        </div>
      )}

      {loading ? <Spinner /> : counts && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Proposals',     value: counts.proposals_total,    colour: 'text-violet-400', bg: 'border-violet-800/30 bg-violet-500/5' },
              { label: 'Pending',       value: counts.proposals_pending,  colour: 'text-amber-400',  bg: 'border-amber-800/30 bg-amber-500/5'   },
              { label: 'Accepted',      value: counts.proposals_accepted, colour: 'text-emerald-400', bg: 'border-emerald-800/30 bg-emerald-500/5' },
              { label: 'Debates',       value: counts.debates_total,      colour: 'text-blue-400',   bg: 'border-blue-800/30 bg-blue-500/5'      },
              { label: 'Votes',         value: counts.votes_total,        colour: 'text-sky-400',    bg: 'border-sky-800/30 bg-sky-500/5'        },
              ...(counts.topics_total !== undefined
                ? [{ label: 'Topics', value: counts.topics_total, colour: 'text-rose-400', bg: 'border-rose-800/30 bg-rose-500/5' }]
                : []),
            ].map(m => (
              <div key={m.label} className={`rounded-xl border px-4 py-4 text-center ${m.bg}`}>
                <p className={`font-bold text-2xl ${m.colour}`}>{m.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>

          {recent.length > 0 && (
            <div className="card-dr">
              <div className="px-5 py-3 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-100">Recent Proposals</h3>
              </div>
              <ul className="divide-y divide-slate-800/60">
                {recent.map(p => (
                  <li key={p.id}>
                    <Link
                      href={`/scotparl/proposals/${p.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-200 truncate">{p.title}</p>
                        {p.topic_name && <p className="text-xs text-blue-400/70 mt-0.5">{p.topic_name}</p>}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-slate-600 hidden sm:block">{fmt(p.updated_at)}</span>
                        <span className={`rounded px-2 py-0.5 text-[11px] font-semibold border ${STATUS_BADGE[p.status] ?? ''}`}>
                          {p.status}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── My Straplines tab (TopicOwner only) ───────────────────────────────────────

function StraplineEditor({ me }: { me: MeData }) {
  const [values, setValues] = useState<Record<number, string>>(
    Object.fromEntries(me.ownedTopics.map(t => [t.id, t.strapline ?? '']))
  );
  const [saving, setSaving] = useState<number | null>(null);
  const [saved,  setSaved]  = useState<number | null>(null);
  const [errs,   setErrs]   = useState<Record<number, string>>({});

  async function save(topicId: number) {
    setSaving(topicId); setErrs(e => ({ ...e, [topicId]: '' }));
    try {
      const r = await fetch(`/api/scotparl/admin/strapline/${topicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strapline: values[topicId] ?? '' }),
      });
      if (!r.ok) {
        const d = await r.json();
        setErrs(e => ({ ...e, [topicId]: d.error ?? 'Save failed' }));
        return;
      }
      setSaved(topicId); setTimeout(() => setSaved(null), 2500);
    } finally { setSaving(null); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-100">My Straplines</h2>
        <p className="text-sm text-slate-400 mt-0.5">Shown above proposals when a visitor filters by your topic.</p>
      </div>
      {me.ownedTopics.map(t => (
        <div key={t.id} className="card-dr px-4 py-4 space-y-2">
          <p className="text-xs font-semibold text-blue-400">{t.name}</p>
          {errs[t.id] && <p className="text-xs text-red-400">{errs[t.id]}</p>}
          <textarea
            value={values[t.id] ?? ''}
            onChange={e => setValues(p => ({ ...p, [t.id]: e.target.value }))}
            rows={3}
            placeholder="Write a short message shown to visitors viewing proposals in this topic…"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
          />
          <button
            onClick={() => save(t.id)}
            disabled={saving === t.id}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
          >
            {saving === t.id ? 'Saving…' : saved === t.id ? 'Saved ✓' : 'Save Strapline'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Site Settings tab (CustomerAdmin only) ────────────────────────────────────

function SiteSettingsTab() {
  const [form, setForm]       = useState<SiteConfig>({ name: '', hero_text: '', hero_image: '', contact_email: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved,  setSaved]    = useState(false);
  const [err,    setErr]      = useState('');

  useEffect(() => {
    fetch('/api/scotparl/admin/site-config')
      .then(r => r.json())
      .then(d => setForm({ name: d.name ?? '', hero_text: d.hero_text ?? '', hero_image: d.hero_image ?? '', contact_email: d.contact_email ?? '' }))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true); setErr(''); setSaved(false);
    try {
      const r = await fetch('/api/scotparl/admin/site-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!r.ok) { const d = await r.json(); setErr(d.error ?? 'Failed'); return; }
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-lg space-y-5">
      {err && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{err}</p>}
      {([
        { label: 'Site Title',     key: 'name'          as const, placeholder: 'e.g. Scottish Parliament Hub' },
        { label: 'Hero Text',      key: 'hero_text'     as const, placeholder: 'Short tagline shown on the homepage' },
        { label: 'Hero Image URL', key: 'hero_image'    as const, placeholder: 'https://…' },
        { label: 'Contact Email',  key: 'contact_email' as const, placeholder: 'contact@example.com' },
      ]).map(f => (
        <div key={f.key}>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">{f.label}</label>
          <input
            value={form[f.key]}
            onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
      ))}
      <button
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
      </button>
    </div>
  );
}

// ── Topics & Owners tab (CustomerAdmin only) ──────────────────────────────────

function TopicsManager({ onTopicsLoaded }: { onTopicsLoaded: (topics: Topic[]) => void }) {
  const [topics, setTopics]     = useState<Topic[]>([]);
  const [loading, setLoading]   = useState(true);
  const [newName, setNewName]   = useState('');
  const [newDesc, setNewDesc]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [editId, setEditId]     = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [err, setErr]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/scotparl/nsp/topics');
      const d = await r.json();
      const loaded: Topic[] = d.topics ?? [];
      setTopics(loaded);
      onTopicsLoaded(loaded);
    } finally { setLoading(false); }
  }, [onTopicsLoaded]);

  useEffect(() => { load(); }, [load]);

  async function createTopic() {
    if (!newName.trim()) { setErr('Name is required'); return; }
    setSaving(true); setErr('');
    try {
      const r = await fetch('/api/scotparl/nsp/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      if (!r.ok) { const d = await r.json(); setErr(d.error ?? 'Failed'); return; }
      setNewName(''); setNewDesc(''); load();
    } finally { setSaving(false); }
  }

  async function updateTopic(id: number) {
    setSaving(true); setErr('');
    try {
      const r = await fetch(`/api/scotparl/nsp/topics/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, description: editDesc }),
      });
      if (!r.ok) { const d = await r.json(); setErr(d.error ?? 'Failed'); return; }
      setEditId(null); load();
    } finally { setSaving(false); }
  }

  async function deleteTopic(id: number) {
    if (!confirm('Delete this topic? This will remove all associated principles.')) return;
    await fetch(`/api/scotparl/nsp/topics/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-slate-100">Topics</h2>
      {err && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {topics.length === 0 && <p className="text-sm text-slate-500">No topics yet.</p>}
          {topics.map(t => (
            <div key={t.id} className="card-dr px-4 py-3">
              {editId === t.id ? (
                <div className="space-y-2">
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                  <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description (optional)" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                  <div className="flex gap-2">
                    <button onClick={() => updateTopic(t.id)} disabled={saving} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors">{saving ? 'Saving…' : 'Save'}</button>
                    <button onClick={() => setEditId(null)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-100">{t.name}</p>
                    {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => { setEditId(t.id); setEditName(t.name); setEditDesc(t.description ?? ''); }} className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">Edit</button>
                    <button onClick={() => deleteTopic(t.id)} className="rounded border border-rose-800/50 px-2.5 py-1 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors">Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="card-dr px-4 py-4 space-y-2 border-dashed">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Add topic</p>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Topic name" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
        <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
        <button onClick={createTopic} disabled={saving || !newName.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors">{saving ? 'Creating…' : 'Create Topic'}</button>
      </div>
    </div>
  );
}

function TopicOwnersManager({ topics }: { topics: Topic[] }) {
  const [owners, setOwners]   = useState<TopicOwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [handle, setHandle]   = useState('');
  const [topicId, setTopicId] = useState<number | ''>('');
  const [adding, setAdding]   = useState(false);
  const [err, setErr]         = useState('');
  const [straplines, setStraplines] = useState<Record<string, Record<number, string>>>({});
  const [savingStrap, setSavingStrap] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/scotparl/admin/topic-owners');
      const d = await r.json();
      setOwners(Array.isArray(d) ? d : []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!handle.trim() || !topicId) { setErr('Handle and topic are required'); return; }
    setAdding(true); setErr('');
    try {
      const r = await fetch('/api/scotparl/admin/topic-owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: handle.trim(), topic_id: topicId }),
      });
      if (!r.ok) { const d = await r.json(); setErr(d.error ?? 'Failed'); return; }
      setHandle(''); setTopicId(''); load();
    } finally { setAdding(false); }
  }

  async function removeTopic(userId: string, tId: number) {
    await fetch(`/api/scotparl/admin/topic-owners/${userId}/${tId}`, { method: 'DELETE' });
    load();
  }

  async function saveStrapline(userId: string, tId: number) {
    const key = `${userId}_${tId}`;
    setSavingStrap(key);
    try {
      await fetch(`/api/scotparl/admin/topic-owners/${userId}/${tId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strapline: straplines[userId]?.[tId] ?? '' }),
      });
    } finally { setSavingStrap(null); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-100">Topic Owners</h2>
        <p className="text-sm text-slate-400 mt-0.5">Topic Owners can open and close debates for their assigned topics.</p>
      </div>
      {err && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
      {loading ? <Spinner /> : owners.length === 0 ? (
        <p className="text-sm text-slate-500">No topic owners assigned yet.</p>
      ) : (
        <div className="space-y-3">
          {owners.map(o => (
            <div key={o.user_id} className="card-dr px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-slate-200">@{o.handle}</p>
              {o.topics.map(t => (
                <div key={t.id} className="pl-3 border-l border-slate-700 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-blue-300">{t.name}</span>
                    <button onClick={() => removeTopic(o.user_id, t.id)} className="text-xs text-rose-500 hover:text-rose-400 transition-colors">Remove</button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={straplines[o.user_id]?.[t.id] ?? ''}
                      onChange={e => setStraplines(p => ({ ...p, [o.user_id]: { ...(p[o.user_id] ?? {}), [t.id]: e.target.value } }))}
                      placeholder="Strapline for this topic owner…"
                      className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => saveStrapline(o.user_id, t.id)}
                      disabled={savingStrap === `${o.user_id}_${t.id}`}
                      className="rounded bg-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-40 transition-colors"
                    >
                      {savingStrap === `${o.user_id}_${t.id}` ? '…' : 'Save'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="card-dr px-4 py-4 space-y-2 border-dashed">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assign Topic Owner</p>
        <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@handle" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
        <select value={topicId} onChange={e => setTopicId(e.target.value ? parseInt(e.target.value) : '')} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
          <option value="">Select topic…</option>
          {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button onClick={add} disabled={adding || !handle.trim() || !topicId} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors">
          {adding ? 'Assigning…' : 'Assign'}
        </button>
      </div>
    </div>
  );
}

// ── Groups tab (CustomerAdmin only) ──────────────────────────────────────────

interface Group { id: number; name: string; description: string | null; member_count: number }
interface GroupMember { user_id: string; handle: string; added_at: string }

function GroupsManager() {
  const [groups, setGroups]       = useState<Group[]>([]);
  const [loading, setLoading]     = useState(true);
  const [newName, setNewName]     = useState('');
  const [newDesc, setNewDesc]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');
  const [expanded, setExpanded]   = useState<number | null>(null);
  const [members, setMembers]     = useState<Record<number, GroupMember[]>>({});
  const [addHandle, setAddHandle] = useState('');
  const [adding, setAdding]       = useState(false);
  const [addErr, setAddErr]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/scotparl/admin/groups');
      const d = await r.json();
      setGroups(d.groups ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadMembers(gid: number) {
    const r = await fetch(`/api/scotparl/admin/groups/${gid}`);
    const d = await r.json();
    setMembers(m => ({ ...m, [gid]: d.members ?? [] }));
  }

  function toggleExpand(gid: number) {
    if (expanded === gid) { setExpanded(null); return; }
    setExpanded(gid);
    loadMembers(gid);
  }

  async function createGroup() {
    if (!newName.trim()) { setErr('Name is required'); return; }
    setSaving(true); setErr('');
    try {
      const r = await fetch('/api/scotparl/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      if (!r.ok) { const d = await r.json(); setErr(d.error ?? 'Failed'); return; }
      setNewName(''); setNewDesc(''); load();
    } finally { setSaving(false); }
  }

  async function deleteGroup(gid: number) {
    if (!confirm('Delete this group?')) return;
    await fetch(`/api/scotparl/admin/groups/${gid}`, { method: 'DELETE' });
    setExpanded(null);
    load();
  }

  async function addMember(gid: number) {
    if (!addHandle.trim()) { setAddErr('Enter a handle'); return; }
    setAdding(true); setAddErr('');
    try {
      const r = await fetch(`/api/scotparl/admin/groups/${gid}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: addHandle.trim().replace(/^@/, '') }),
      });
      if (!r.ok) { const d = await r.json(); setAddErr(d.error ?? 'Failed'); return; }
      setAddHandle(''); loadMembers(gid); load();
    } finally { setAdding(false); }
  }

  async function removeMember(gid: number, userId: string) {
    await fetch(`/api/scotparl/admin/groups/${gid}/members/${userId}`, { method: 'DELETE' });
    loadMembers(gid); load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-100">User Groups</h2>
        <p className="text-sm text-slate-400 mt-0.5">Groups let you target debates and votes at specific sets of users.</p>
      </div>
      {err && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
      {loading ? <Spinner /> : groups.length === 0 ? (
        <p className="text-sm text-slate-500">No groups yet.</p>
      ) : (
        <div className="space-y-2">
          {groups.map(g => (
            <div key={g.id} className="card-dr">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-100">{g.name}</p>
                  {g.description && <p className="text-xs text-slate-500 mt-0.5">{g.description}</p>}
                  <p className="text-xs text-slate-600 mt-0.5">{g.member_count} {g.member_count === 1 ? 'member' : 'members'}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => toggleExpand(g.id)} className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                    {expanded === g.id ? 'Close' : 'Members'}
                  </button>
                  <button onClick={() => deleteGroup(g.id)} className="rounded border border-rose-800/50 px-2.5 py-1 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors">Delete</button>
                </div>
              </div>
              {expanded === g.id && (
                <div className="border-t border-slate-800/60 px-4 py-3 space-y-3">
                  <div className="space-y-1.5">
                    {(members[g.id] ?? []).length === 0 ? (
                      <p className="text-xs text-slate-600">No members yet.</p>
                    ) : (members[g.id] ?? []).map(m => (
                      <div key={m.user_id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">@{m.handle}</span>
                        <button onClick={() => removeMember(g.id, m.user_id)} className="text-rose-500 hover:text-rose-400 transition-colors">Remove</button>
                      </div>
                    ))}
                  </div>
                  {addErr && <p className="text-xs text-rose-400">{addErr}</p>}
                  <div className="flex gap-2">
                    <input
                      value={addHandle}
                      onChange={e => setAddHandle(e.target.value)}
                      placeholder="@handle"
                      className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                    <button onClick={() => addMember(g.id)} disabled={adding} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40 transition-colors">
                      {adding ? '…' : 'Add'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="card-dr px-4 py-4 space-y-2 border-dashed">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Create group</p>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Group name (e.g. Committee)" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
        <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
        <button onClick={createGroup} disabled={saving || !newName.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors">
          {saving ? 'Creating…' : 'Create Group'}
        </button>
      </div>
    </div>
  );
}

// ── Analysis tab (CustomerAdmin only) ─────────────────────────────────────────

interface TopicStatus {
  id: number; name: string;
  last_run_at: string | null; scored_count: number;
  principles_changed_at: string | null;
  total_entities: number; pending_count: number; principles_stale: boolean;
}
interface UsageStat {
  month: string; analysis_type: string;
  calls: number; input_tokens: number; output_tokens: number; cost_micro: number;
}
interface RunResult { mode?: string; processed: number; remaining: number; done: boolean; cost_cents: string; }

function LightAnalysisManager() {
  const [data, setData] = useState<{
    topics: TopicStatus[]; stats: UsageStat[]; budget: number | null;
    last_analysed_at?: string | null;
  } | null>(null);
  const [loading, setLoading]       = useState(true);
  const [runningId, setRunningId]   = useState<number | 'all' | null>(null);
  const [result, setResult]         = useState<RunResult | null>(null);
  const [err, setErr]               = useState('');
  const [batchCount, setBatchCount] = useState(0);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [sinceDt, setSinceDt]       = useState('');
  const runningRef = useRef(false);

  const loadDataQuiet = useCallback(async () => {
    const r = await fetch('/api/scotparl/nsp/light-impact');
    if (r.ok) setData(await r.json());
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/scotparl/nsp/light-impact');
      if (r.ok) setData(await r.json());
      else { const d = await r.json(); setErr(d.error ?? 'Failed to load'); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Poll GET every 6s while a run is in progress so progress bars update live
  useEffect(() => {
    if (runningId === null) return;
    const id = setInterval(loadDataQuiet, 6000);
    return () => clearInterval(id);
  }, [runningId, loadDataQuiet]);

  async function runAnalysis(topicId: number | undefined, fullRerun: boolean) {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunningId(topicId ?? 'all');
    setResult(null); setErr('');
    setBatchCount(0); setTotalProcessed(0);

    let batch = 0;
    let processed = 0;
    try {
      while (true) {
        const r = await fetch('/api/scotparl/nsp/light-impact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(topicId ? { topic_id: topicId } : {}),
            // Only send full_rerun on first batch — subsequent passes are incremental
            ...(fullRerun && batch === 0 ? { full_rerun: true } : {}),
            ...(!topicId && sinceDt ? { since_dt: sinceDt } : {}),
          }),
        });
        if (!r.ok) { const d = await r.json(); setErr(d.error ?? 'Analysis failed'); break; }
        const res: RunResult = await r.json();
        batch++;
        processed += res.processed;
        setBatchCount(batch);
        setTotalProcessed(processed);
        setResult({ ...res, processed });
        await loadDataQuiet();
        if (res.done || res.remaining === 0) break;
        if (res.processed === 0) { setErr('No progress — remaining entities may have no content to analyse.'); break; }
      }
    } finally {
      runningRef.current = false;
      setRunningId(null);
      loadData();
    }
  }

  function microToDisplay(micro: number) {
    const cents = micro / 10_000;
    return cents >= 100 ? `$${(cents / 100).toFixed(2)}` : `${cents.toFixed(2)}¢`;
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-100">Light AI Analysis</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Scores all laws and proposals 1–10 for relevance to each of the 12 topics using a lightweight AI model.
          Use <strong className="text-slate-300">Analyse All Topics</strong> to score each item once across all topics in a single API call —
          the most cost-efficient approach (~3× cheaper than per-topic runs).
          Use per-topic <strong className="text-slate-300">Re-run</strong> only after editing a single topic&apos;s principles.
          {data?.budget != null && (
            <> Monthly budget: <span className="text-slate-300">${((data.budget) / 100).toFixed(2)}</span>.</>
          )}
        </p>
      </div>

      {data?.last_analysed_at && (
        <p className="text-xs text-slate-500">
          Last analysed: <span className="text-slate-400">{new Date(data.last_analysed_at).toLocaleString()}</span>
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Only re-analyse items not scored since</label>
          <input
            type="datetime-local"
            value={sinceDt}
            onChange={e => setSinceDt(e.target.value)}
            disabled={runningId !== null}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 disabled:opacity-40 focus:outline-none focus:border-slate-500"
          />
        </div>
        {sinceDt && (
          <button
            onClick={() => setSinceDt('')}
            disabled={runningId !== null}
            className="mt-5 text-xs text-slate-500 hover:text-slate-300 disabled:opacity-40"
          >
            Clear date
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => runAnalysis(undefined, false)}
          disabled={runningId !== null}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors flex items-center gap-2"
        >
          {runningId === 'all' ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent inline-block" />
              {batchCount > 0 ? `Batch ${batchCount + 1}…` : 'Starting…'}
            </>
          ) : 'Analyse All Topics'}
        </button>
        <button
          onClick={() => {
            if (!confirm('This will delete ALL existing scores and re-analyse everything from scratch. Continue?')) return;
            runAnalysis(undefined, true);
          }}
          disabled={runningId !== null}
          className="rounded-lg border border-rose-800/40 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 transition-colors"
        >
          Full Re-run All
        </button>
      </div>

      {err && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{err}</p>
      )}

      {runningId !== null && batchCount > 0 && (
        <div className="rounded-xl border border-blue-800/30 bg-blue-500/5 px-4 py-3 text-sm text-blue-300 flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent flex-shrink-0" />
          <span>
            Batch {batchCount} complete · {totalProcessed.toLocaleString()} entities processed so far
            {result && result.remaining > 0 && (
              <span className="text-slate-400"> · ~{result.remaining.toLocaleString()} remaining</span>
            )}
          </span>
        </div>
      )}

      {result && runningId === null && (
        <div className="rounded-xl border border-emerald-800/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">
          ✓ {batchCount > 1 ? `${batchCount} batches · ` : ''}{totalProcessed.toLocaleString()} {result.mode === 'multi-topic' ? 'entities (all 12 topics)' : 'items'} processed
          {' '}· cost {parseFloat(result.cost_cents).toFixed(4)}¢
          {!result.done && result.remaining > 0 && (
            <span className="text-slate-400"> · {result.remaining.toLocaleString()} remaining</span>
          )}
        </div>
      )}

      <div className="space-y-3">
        {(data?.topics ?? []).map(t => (
          <div key={t.id} className="card-dr px-4 py-4 space-y-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100">{t.name}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-500">
                  <span>{t.last_run_at ? `Last run ${fmt(t.last_run_at)}` : 'Never run'}</span>
                  <span>{t.scored_count} scored</span>
                  <span className={t.pending_count > 0 ? 'text-amber-400' : ''}>{t.pending_count} pending</span>
                </div>
                {t.principles_stale && (
                  <p className="mt-1.5 text-xs text-amber-400">
                    ⚠ Principles changed since last run — consider a full re-run
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => runAnalysis(t.id, false)}
                  disabled={runningId !== null}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 disabled:opacity-40 transition-colors"
                >
                  {runningId === t.id ? (
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 animate-spin rounded-full border border-blue-500 border-t-transparent inline-block" />
                      Running…
                    </span>
                  ) : 'Run Incremental'}
                </button>
                <button
                  onClick={() => runAnalysis(t.id, true)}
                  disabled={runningId !== null}
                  className="rounded-lg border border-rose-800/40 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 transition-colors"
                >
                  Full Re-run
                </button>
              </div>
            </div>
            {t.total_entities > 0 && (
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500/60 transition-all"
                    style={{ width: `${Math.min(100, Math.round((t.scored_count / t.total_entities) * 100))}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-600">
                  {t.scored_count} / {t.total_entities} entities scored ({Math.round((t.scored_count / t.total_entities) * 100)}%)
                </p>
              </div>
            )}
          </div>
        ))}
        {(data?.topics ?? []).length === 0 && (
          <p className="text-sm text-slate-500">No topics found. Create topics first.</p>
        )}
      </div>

      {(data?.stats ?? []).length > 0 && (
        <div className="card-dr">
          <div className="px-5 py-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100">AI Usage (Last 6 Months)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Month</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium text-right">Calls</th>
                  <th className="px-4 py-2.5 font-medium text-right hidden sm:table-cell">Tokens In</th>
                  <th className="px-4 py-2.5 font-medium text-right hidden sm:table-cell">Tokens Out</th>
                  <th className="px-4 py-2.5 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data!.stats.map((s, i) => (
                  <tr key={i} className="text-slate-300">
                    <td className="px-4 py-2.5 font-mono text-slate-400">{s.month}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                        s.analysis_type === 'heavy'
                          ? 'bg-violet-500/10 text-violet-300 border-violet-500/20'
                          : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                      }`}>{s.analysis_type}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{s.calls.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums hidden sm:table-cell">{s.input_tokens.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums hidden sm:table-cell">{s.output_tokens.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-amber-300">{microToDisplay(s.cost_micro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'straplines' | 'topics' | 'groups' | 'settings' | 'analysis';

export default function CustomerAdminPage() {
  const [me, setMe]               = useState<MeData | null>(null);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [tab, setTab]             = useState<Tab>('overview');
  const [loadingMe, setLoadingMe] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/scotparl/admin/me').then(r => r.ok ? r.json() : null),
      fetch('/api/scotparl/nsp/topics').then(r => r.ok ? r.json() : { topics: [] }),
    ]).then(([meData, topicsData]) => {
      if (meData) setMe(meData);
      setAllTopics(topicsData.topics ?? []);
    }).finally(() => setLoadingMe(false));
  }, []);

  const tabs: { id: Tab; label: string; show: boolean }[] = me ? [
    { id: 'overview',   label: 'Overview',        show: true },
    { id: 'straplines', label: 'My Straplines',   show: !me.isCustomerAdmin && me.isTopicOwner },
    { id: 'topics',     label: 'Topics & Owners', show: me.isCustomerAdmin },
    { id: 'groups',     label: 'User Groups',     show: me.isCustomerAdmin },
    { id: 'analysis',   label: 'Analysis',        show: me.isCustomerAdmin },
    { id: 'settings',   label: 'Site Settings',   show: me.isCustomerAdmin },
  ] : [];

  if (loadingMe) return (
    <div className="flex justify-center py-24">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  );

  if (!me) return (
    <div className="text-center py-24 text-slate-500">Access denied.</div>
  );

  return (
    <div className="min-h-screen bg-dr-base py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-3xl">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">Admin</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {me.isCustomerAdmin ? 'Customer Admin' : 'Topic Owner'}
          </p>
        </div>

        <div className="flex items-center gap-1 border-b border-slate-800 mb-8 overflow-x-auto scrollbar-none">
          {tabs.filter(t => t.show).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'text-blue-400 border-blue-500'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview'   && <OverviewTab me={me} allTopics={allTopics} />}
        {tab === 'straplines' && <StraplineEditor me={me} />}
        {tab === 'topics'     && me.isCustomerAdmin && (
          <div className="space-y-10">
            <TopicsManager onTopicsLoaded={setAllTopics} />
            <div className="border-t border-slate-800 pt-10">
              <TopicOwnersManager topics={allTopics} />
            </div>
          </div>
        )}
        {tab === 'groups'     && me.isCustomerAdmin && <GroupsManager />}
        {tab === 'analysis'   && me.isCustomerAdmin && <LightAnalysisManager />}
        {tab === 'settings'   && me.isCustomerAdmin && <SiteSettingsTab />}

      </div>
    </div>
  );
}
