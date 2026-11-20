'use client';

import ApiParties from '@/components/admin/ApiParties';
import AiTab from '@/components/admin/AiTab';
import PrivacyTab from '@/components/admin/PrivacyTab';
import { useEffect, useState, useCallback } from 'react';
import SocietyImageField from '@/components/societies/SocietyImageField';
import PrincipleForm, { CATEGORY_META, type PrincipleFields } from '@/components/principles/PrincipleForm';
import Link from 'next/link';
import AnalyticsView, { type Stats } from '@/components/analytics/AnalyticsView';

// Analytics: components/analytics/AnalyticsView.tsx (shared with Society Admin)

// ── Customers tab ─────────────────────────────────────────────────────────────

interface CustomerRow {
  id: number; name: string; subdomain: string; status: string;
  hero_text: string | null; contact_email: string | null;
  hero_image: string | null; description: string | null;
  platform_contact_email: string | null; created_at: string;
  alert_count: number; debate_count: number;
  is_public: boolean; visibility: 'public' | 'apply' | 'invite'; is_default: boolean; is_demo: boolean;
}

interface CustomerAdmin { user_id: string; handle: string; created_at: string; }

function CustomerAdminsPanel({ customerId }: { customerId: number }) {
  const [admins, setAdmins]   = useState<CustomerAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [handle, setHandle]   = useState('');
  const [adding, setAdding]   = useState(false);
  const [err, setErr]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/customers/${customerId}/admins`);
      setAdmins(await r.json());
    } finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!handle.trim()) return;
    setAdding(true); setErr('');
    try {
      const r = await fetch(`/api/admin/customers/${customerId}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: handle.trim() }),
      });
      if (!r.ok) { const d = await r.json(); setErr(d.error ?? 'Failed'); return; }
      setHandle(''); load();
    } finally { setAdding(false); }
  }

  async function remove(userId: string) {
    await fetch(`/api/admin/customers/${customerId}/admins/${userId}`, { method: 'DELETE' });
    load();
  }

  if (loading) return <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent ml-1" />;

  return (
    <div className="mt-4 pt-4 border-t border-slate-800">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Society Admins</p>
      {err && <p className="text-xs text-red-400 mb-2">{err}</p>}
      {admins.length === 0 ? (
        <p className="text-xs text-slate-600 mb-2">No admins assigned.</p>
      ) : (
        <ul className="space-y-1 mb-3">
          {admins.map(a => (
            <li key={a.user_id} className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-mono">@{a.handle}</span>
              <button onClick={() => remove(a.user_id)} className="text-rose-500 hover:text-rose-400 transition-colors">Remove</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={handle}
          onChange={e => setHandle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="@handle"
          className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={add}
          disabled={adding || !handle.trim()}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
        >
          {adding ? '…' : 'Add'}
        </button>
      </div>
    </div>
  );
}

// Membership for a PRIVATE society — who sees it listed under "Private
// Societies" in the nav and can switch to it. Mirrors CustomerAdminsPanel.
function SocietyMembersPanel({ customerId }: { customerId: number }) {
  const [members, setMembers] = useState<CustomerAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [handle, setHandle]   = useState('');
  const [adding, setAdding]   = useState(false);
  const [err, setErr]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/customers/${customerId}/members`);
      setMembers(await r.json());
    } finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!handle.trim()) return;
    setAdding(true); setErr('');
    try {
      const r = await fetch(`/api/admin/customers/${customerId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: handle.trim() }),
      });
      if (!r.ok) { const d = await r.json(); setErr(d.error ?? 'Failed'); return; }
      setHandle(''); load();
    } finally { setAdding(false); }
  }

  async function remove(userId: string) {
    await fetch(`/api/admin/customers/${customerId}/members/${userId}`, { method: 'DELETE' });
    load();
  }

  if (loading) return <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent ml-1" />;

  return (
    <div className="mt-4 pt-4 border-t border-slate-800">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Private Society Members</p>
      {err && <p className="text-xs text-red-400 mb-2">{err}</p>}
      {members.length === 0 ? (
        <p className="text-xs text-slate-600 mb-2">No members yet — nobody but sysadmin can see this society.</p>
      ) : (
        <ul className="space-y-1 mb-3">
          {members.map(m => (
            <li key={m.user_id} className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-mono">@{m.handle}</span>
              <button onClick={() => remove(m.user_id)} className="text-rose-500 hover:text-rose-400 transition-colors">Remove</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={handle}
          onChange={e => setHandle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="@handle"
          className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={add}
          disabled={adding || !handle.trim()}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
        >
          {adding ? '…' : 'Add'}
        </button>
      </div>
    </div>
  );
}

// Society dashboard image — uploads/removes immediately (not on Save), since
// the file has to reach the server either way.
const STATUS_CHIP: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  paused: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  closed: 'bg-slate-700 text-slate-400 border-slate-600',
};

function CustomersTab() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState<CustomerRow | null>(null);
  const [saving, setSaving]       = useState(false);
  const [savedId, setSavedId]     = useState<number | null>(null); // brief "Saved" confirmation
  const [showNew, setShowNew]     = useState(false);
  const [newForm, setNewForm]     = useState({ name: '', subdomain: '', hero_text: '', contact_email: '', platform_contact_email: '' });
  const [newSaving, setNewSaving] = useState(false);
  const [err, setErr]             = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/customers');
      setCustomers(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveEdit() {
    if (!editing) return;
    setSaving(true); setErr('');
    try {
      const r = await fetch(`/api/admin/customers/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });
      if (!r.ok) { const d = await r.json(); setErr(d.error ?? 'Save failed'); return; }
      const savedId = editing.id;
      setEditing(null);
      setSavedId(savedId);
      setTimeout(() => setSavedId(cur => (cur === savedId ? null : cur)), 3000);
      load();
    } finally { setSaving(false); }
  }

  async function setDemo(c: { id: number; name: string; visibility: string }, demo: boolean) {
    if (demo && !confirm(`Make ${c.name} the demo Society? It becomes public, all its debates become public, and its discussions open to everyone, even without an account.${c.visibility !== 'public' ? ' Its encrypted content will be decrypted.' : ''}`)) return;
    setErr('');
    const r = await fetch(`/api/admin/customers/${c.id}/demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ demo }) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error ?? 'Failed'); return; }
    load();
  }

  async function setDefault(id: number) {
    setErr('');
    const r = await fetch(`/api/admin/customers/${id}/set-default`, { method: 'POST' });
    if (!r.ok) { const d = await r.json(); setErr(d.error ?? 'Failed'); return; }
    load();
  }

  async function createCustomer() {
    if (!newForm.name.trim() || !newForm.subdomain.trim()) { setErr('Name and subdomain are required'); return; }
    setNewSaving(true); setErr('');
    try {
      const r = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm),
      });
      if (!r.ok) { const d = await r.json(); setErr(d.error ?? 'Create failed'); return; }
      setShowNew(false);
      setNewForm({ name: '', subdomain: '', hero_text: '', contact_email: '', platform_contact_email: '' });
      load();
    } finally { setNewSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div className="space-y-5">
      {err && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{err}</p>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{customers.length} societ{customers.length !== 1 ? 'ies' : 'y'}</p>
        <button onClick={() => { setShowNew(true); setErr(''); }} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors">
          + New Society
        </button>
      </div>

      {/* New society form */}
      {showNew && (
        <div className="card-dr p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100">New Society</h3>
          {[
            { label: 'Name', key: 'name', placeholder: 'e.g. ScotParl' },
            { label: 'Subdomain', key: 'subdomain', placeholder: 'e.g. scotparl' },
            { label: 'Hero text', key: 'hero_text', placeholder: 'Short tagline shown on the site' },
            { label: 'Contact email', key: 'contact_email', placeholder: 'customer@example.com' },
            { label: 'Platform contact email', key: 'platform_contact_email', placeholder: 'admin@new.vote' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
              <input
                value={(newForm as Record<string, string>)[f.key]}
                onChange={e => setNewForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={createCustomer} disabled={newSaving} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors">
              {newSaving ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowNew(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {customers.map(c => (
          <div key={c.id} className="card-dr p-5">
            {editing?.id === c.id ? (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {(['active', 'paused', 'closed'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setEditing(e => e ? { ...e, status: s } : e)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors ${editing.status === s ? STATUS_CHIP[s] : 'border-slate-700 text-slate-500'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {[
                  { label: 'Name', key: 'name' },
                  { label: 'Hero text', key: 'hero_text' },
                  { label: 'Contact email', key: 'contact_email' },
                  { label: 'Platform contact email', key: 'platform_contact_email' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                    <input
                      value={(editing as unknown as Record<string, string>)[f.key] ?? ''}
                      onChange={e => setEditing(p => p ? { ...p, [f.key]: e.target.value } : p)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Description</label>
                  <textarea
                    value={editing.description ?? ''}
                    onChange={e => setEditing(p => p ? { ...p, description: e.target.value } : p)}
                    rows={6}
                    placeholder="Describe the society in more detail — shown on its dashboard under the image. Line breaks are kept."
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-y"
                  />
                </div>
                <SocietyImageField
                  endpoint={`/api/admin/customers/${editing.id}/image`}
                  value={editing.hero_image}
                  onChange={path => {
                    setEditing(p => p ? { ...p, hero_image: path } : p);
                    setCustomers(cs => cs.map(c => c.id === editing.id ? { ...c, hero_image: path } : c));
                  }}
                />
                <label className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                  Visibility
                  <select
                    value={editing.visibility}
                    onChange={e => setEditing(p => p ? { ...p, visibility: e.target.value as 'public' | 'apply' | 'invite', is_public: e.target.value === 'public' } : p)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
                  >
                    <option value="public">Public — anyone can see and enter</option>
                    <option value="apply">Apply — listed to all; members only, anyone can ask to join</option>
                    <option value="invite">Invite — hidden; members join by invite link</option>
                  </select>
                  {editing.is_default && editing.visibility !== 'public' && (
                    <span className="text-amber-400"> (will stop being the default)</span>
                  )}
                </label>
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(null)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-slate-100">{c.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_CHIP[c.status] ?? STATUS_CHIP.closed}`}>{c.status}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${c.is_public ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' : 'bg-violet-500/15 text-violet-300 border-violet-500/30'}`}>
                      {c.visibility === 'public' ? 'Public' : c.visibility === 'apply' ? 'Apply' : 'Invite'}
                    </span>
                    {c.is_default && (
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-300 border-amber-500/30">Default</span>
                    )}
                    {c.is_demo && (
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Demo</span>
                    )}
                    <span className="text-xs text-slate-500 font-mono">{c.subdomain}</span>
                  </div>
                  {c.hero_text && <p className="text-xs text-slate-400 mb-1">{c.hero_text}</p>}
                  <div className="flex flex-wrap gap-4 mt-1.5 text-xs text-slate-500">
                    <span title="Open alerts and flags: scan alerts pending review, and user flags not yet cleared">{c.alert_count} open alerts/flags</span>
                    <span>{c.debate_count} debates</span>
                    {c.contact_email && <span>Contact: {c.contact_email}</span>}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {savedId === c.id && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400" role="status">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      Saved
                    </span>
                  )}
                  {c.is_public && !c.is_default && (
                    <button onClick={() => setDefault(c.id)} className="rounded-lg border border-amber-700/40 px-3 py-1.5 text-xs text-amber-400 hover:border-amber-500 transition-colors">
                      Set as default
                    </button>
                  )}
                  <button onClick={() => setDemo(c, !c.is_demo)}
                    className="rounded-lg border border-emerald-700/40 px-3 py-1.5 text-xs text-emerald-400 hover:border-emerald-500 transition-colors"
                    title={c.is_demo ? 'Stop this being the demo Society' : 'Make this the demo: public, every debate public, discussions open to all'}>
                    {c.is_demo ? 'Stop demo' : 'Make demo'}
                  </button>
                  <button onClick={() => { setEditing(c); setErr(''); }} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors">
                    Edit
                  </button>
                </div>
              </div>
            )}
            <CustomerAdminsPanel customerId={c.id} />
            {!c.is_public && <SocietyMembersPanel customerId={c.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Access Keys tab ───────────────────────────────────────────────────────────
// SysAdmin-issued keys that let a named recipient view chosen debates
// read-only, without an account. The link is shown once, at creation.

interface AccessKeyRow {
  id: string; label: string; created_at: string; expires_at: string | null;
  revoked_at: string | null; first_used_at: string | null; last_used_at: string | null;
  use_count: number; created_by_handle: string | null;
  debates: { id: string; title: string }[];
}
interface KeyDebateOption { id: string; title: string; visibility: string; society: string | null }

function fmtDateTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

function AccessKeysTab() {
  const [keys, setKeys]         = useState<AccessKeyRow[]>([]);
  const [debates, setDebates]   = useState<KeyDebateOption[]>([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [showNew, setShowNew]   = useState(false);
  const [label, setLabel]       = useState('');
  const [chosen, setChosen]     = useState<Set<string>>(new Set());
  const [expiry, setExpiry]     = useState('30'); // days; '' = never
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink]   = useState<{ label: string; url: string } | null>(null);
  const [copied, setCopied]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, d] = await Promise.all([
        fetch('/api/admin/access-keys').then(r => r.json()),
        fetch('/api/admin/access-keys/debates').then(r => r.json()),
      ]);
      setKeys(Array.isArray(k) ? k : []);
      setDebates(Array.isArray(d) ? d : []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setErr(''); setCreating(true);
    try {
      const r = await fetch('/api/admin/access-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          resolutionIds: [...chosen],
          expiresInDays: expiry.trim() === '' ? null : Number(expiry),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? 'Could not create key'); return; }
      setNewLink({ label, url: window.location.origin + d.path });
      setCopied(false);
      setShowNew(false); setLabel(''); setChosen(new Set()); setExpiry('30');
      load();
    } finally { setCreating(false); }
  }

  async function revoke(id: string) {
    if (!window.confirm('Revoke this key? Anyone using it loses access immediately.')) return;
    await fetch(`/api/admin/access-keys/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'revoke' }),
    });
    load();
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this key and its record? This cannot be undone.')) return;
    await fetch(`/api/admin/access-keys/${id}`, { method: 'DELETE' });
    load();
  }

  async function copyLink() {
    if (!newLink) return;
    try { await navigator.clipboard.writeText(newLink.url); setCopied(true); } catch { /* select manually */ }
  }

  function status(k: AccessKeyRow): { text: string; cls: string } {
    if (k.revoked_at) return { text: 'Revoked', cls: 'bg-slate-700 text-slate-400 border-slate-600' };
    if (k.expires_at && new Date(k.expires_at) < new Date()) return { text: 'Expired', cls: 'bg-slate-700 text-slate-400 border-slate-600' };
    if (k.first_used_at) return { text: 'Active · used', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    return { text: 'Active · not yet used', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
  }

  if (loading) return <div className="flex justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div className="space-y-5">
      {err && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{err}</p>}

      {newLink && (
        <div className="card-dr p-5 border-emerald-500/40">
          <p className="text-sm font-semibold text-slate-100 mb-1">Key created for “{newLink.label}”</p>
          <p className="text-xs text-amber-400 mb-3">Copy this link now — it is shown only once and can&apos;t be retrieved later.</p>
          <div className="flex gap-2">
            <input readOnly value={newLink.url} onFocus={e => e.target.select()}
              className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-slate-200" />
            <button onClick={copyLink} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors">
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
            <button onClick={() => setNewLink(null)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
              Done
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Read-only access to chosen debates without an account. Revoking a key cuts off access immediately.
        </p>
        <button onClick={() => { setShowNew(true); setErr(''); }} className="flex-shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors">
          + New Key
        </button>
      </div>

      {showNew && (
        <div className="card-dr p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100">New Access Key</h3>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Who is it for?</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Their name, e.g. Jane Smith — shown as “Welcome Jane Smith”"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Debates it unlocks</label>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-800">
              {debates.map(d => (
                <label key={d.id} className="flex items-start gap-2.5 px-3 py-2 text-sm text-slate-300 cursor-pointer hover:bg-slate-800/40">
                  <input type="checkbox" className="mt-0.5" checked={chosen.has(d.id)}
                    onChange={e => setChosen(prev => { const n = new Set(prev); if (e.target.checked) n.add(d.id); else n.delete(d.id); return n; })} />
                  <span className="flex-1">{d.title}</span>
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">{d.society ?? '—'} · {d.visibility}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Expires after (days) — leave blank for no expiry</label>
            <input value={expiry} onChange={e => setExpiry(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric"
              className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={create} disabled={creating || !label.trim() || chosen.size === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors">
              {creating ? 'Creating…' : 'Create key'}
            </button>
            <button onClick={() => setShowNew(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {keys.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No access keys yet.</p>
      ) : (
        <div className="space-y-3">
          {keys.map(k => {
            const st = status(k);
            const live = !k.revoked_at && !(k.expires_at && new Date(k.expires_at) < new Date());
            return (
              <div key={k.id} className="card-dr p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-slate-100">{k.label}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${st.cls}`}>{st.text}</span>
                    </div>
                    <ul className="text-xs text-slate-400 mb-2 space-y-0.5">
                      {k.debates.map(d => <li key={d.id}>• {d.title}</li>)}
                    </ul>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Created {fmtDateTime(k.created_at)}{k.created_by_handle ? ` by @${k.created_by_handle}` : ''}</span>
                      <span>Expires {k.expires_at ? fmtDateTime(k.expires_at) : 'never'}</span>
                      <span>First opened {fmtDateTime(k.first_used_at)}</span>
                      <span>Last active {fmtDateTime(k.last_used_at)}</span>
                      <span>Link opened {k.use_count}×</span>
                      {k.revoked_at && <span>Revoked {fmtDateTime(k.revoked_at)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    {live && (
                      <button onClick={() => revoke(k.id)} className="rounded-lg border border-rose-700/40 px-3 py-1.5 text-xs text-rose-400 hover:border-rose-500 transition-colors">
                        Revoke
                      </button>
                    )}
                    <button onClick={() => remove(k.id)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type AdminTab = 'analytics' | 'customers' | 'keys' | 'moderators' | 'library' | 'scanning' | 'ai' | 'privacy' | 'apiparties';

// A reminder, at the top of each section, of what the Sys Admin is responsible
// for there and how to carry it out
const TAB_HELP: Record<AdminTab, string> = {
  analytics:
    'Keep an eye on the platform’s health and growth. Look in weekly: click a tile to see its last 12 months. A rise in Alerts & flags means moderators may need support, so check the Review queue. Use Stale debates to nudge owners or close debates that have run their course. If System health shows memory climbing or uptime resetting unexpectedly, the server needs attention.',
  customers:
    'You decide which Societies exist and who runs them. Create a Society here and you become its admin and first member; appoint or remove its admins, set its visibility, and choose the Demo Society. A Society with many open alerts/flags may need its moderators prompting. Day-to-day settings belong to each Society’s own moderators, under Manage Societies.',
  keys:
    'Access keys let named guests, such as reviewers or journalists, read chosen private debates without an account. Create one key per person, pick the debates, and send the link at once: it is shown only once. Revoke a key as soon as the review is over, and use “last used” to spot keys no longer needed.',
  moderators:
    'Moderators can create and run Societies, so approving a request is a trust decision. Check the person’s handle, message and activity before approving; approval takes effect at once. If unsure, decline, and contact them to explain or ask for more.',
  library:
    'These principles are starting templates that moderators copy into their Societies. Keep them clear, neutral and grounded, with a “why” for each. Editing here doesn’t change copies Societies already hold, so tell moderators about important improvements.',
  scanning:
    'The abuse scanner checks all text automatically; your job is to keep it running and fair. Check that it is configured and that pending alerts aren’t piling up. After the scanner’s rules change, use “Rescan everything”. Alerts about profiles come to you; everything else goes to each Society’s moderators.',
  ai:
    'You control what the platform’s AI costs. Set the daily cap to what you’re willing to pay: when it’s reached, platform AI pauses until midnight UTC and features use their non-AI versions. Review failed calls and each Society’s usage here; Societies with their own AI provider pay for their own use.',
  privacy:
    'You can reach private Societies’ content, but should never do so routinely. Keep the master key offline when you can. Open emergency access only for a serious report or a legal request, with a clear reason: it is time-limited, logged, and the Society is told straight away. Review the access log regularly.',
  apiparties:
    'API Parties are external platforms that post statements for their own users. Issue a token only to platforms you have agreed terms with, limit each to the debates it needs, and revoke a token straight away if it is leaked or misused.',
};

// ── Abuse scanning ───────────────────────────────────────────────────────────
type ScanRun = { id: string; kind: string; started_at: string; finished_at: string | null; items_scanned: number; alerts_raised: number; error: string | null; started_by: string | null };

function ScanningTab() {
  const [data, setData] = useState<{ runs: ScanRun[]; totals: { scanned: number; pending: number; alerts: number }; byType: { content_type: string; n: number }[]; configured: boolean } | null>(null);
  const [starting, setStarting] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch('/api/admin/scan');
    if (r.ok) setData(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);
  // Refresh while a run is in progress
  useEffect(() => {
    if (!data?.runs.some(r => !r.finished_at)) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [data, load]);

  async function start(full: boolean) {
    if (full && !confirm('Rescan all text on the site? This can take a few minutes.')) return;
    setStarting(true);
    await fetch('/api/admin/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full }) });
    setTimeout(() => { setStarting(false); load(); }, 1500);
  }

  if (!data) return <div className="h-24 rounded-xl bg-slate-800/40 animate-pulse" />;
  const fmt = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const running = data.runs.some(r => !r.finished_at);
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-400">
        All text people write (debates, chat, discussions, documents, events, principles, projects, Society pages and profiles) is checked by the abuse scanner in the background:
        new and changed text every 15 minutes, with a daily safety-net pass at 03:00. Nobody waits for it. Use “Rescan everything” after the scanner’s rules change. Flagged content goes to the Alert Review queue of the Society&apos;s moderators (profiles to SysAdmin).
      </p>
      {!data.configured && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">The scanner service isn&apos;t configured on this server.</p>}
      <div className="grid grid-cols-3 gap-3">
        {[['Items scanned', data.totals.scanned], ['Alerts pending', data.totals.pending], ['Alerts in total', data.totals.alerts]].map(([l, n]) => (
          <div key={l as string} className="rounded-xl border border-slate-800 bg-dr-card px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">{l}</p>
            <p className="text-2xl font-bold tabular-nums text-slate-100">{n}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => start(false)} disabled={starting || running} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
          {running ? 'Scan running…' : 'Scan new & changed now'}
        </button>
        <button onClick={() => start(true)} disabled={starting || running} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 disabled:opacity-50">Rescan everything</button>
        <a href="/dashboard/scanner" className="px-2 py-2 text-sm text-blue-400 hover:underline">Open Alert Review →</a>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/60 text-slate-500"><tr><th className="px-3 py-2">Started</th><th className="px-3 py-2">Kind</th><th className="px-3 py-2 text-right">Scanned</th><th className="px-3 py-2 text-right">Alerts</th><th className="px-3 py-2">Result</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {data.runs.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-500">No scans yet. The first runs a minute after the server starts.</td></tr>
            ) : data.runs.map(r => (
              <tr key={r.id} className="text-slate-300">
                <td className="px-3 py-2">{fmt(r.started_at)}</td>
                <td className="px-3 py-2">{r.kind === 'interval' ? 'Every 15 min' : r.kind === 'daily' ? 'Daily (full)' : `Manual${r.started_by ? ` · @${r.started_by}` : ''}`}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.items_scanned}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${r.alerts_raised ? 'text-amber-300' : ''}`}>{r.alerts_raised}</td>
                <td className="px-3 py-2">{!r.finished_at ? <span className="text-blue-300">Running…</span> : r.error ? <span className="text-rose-300">{r.error}</span> : <span className="text-emerald-300">Done</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Principles library ───────────────────────────────────────────────────────
// The general-purpose principles Moderators can copy into their Societies.
type LibraryPrinciple = PrincipleFields & { id: string; library: string };

function PrinciplesLibraryTab() {
  const [rows, setRows] = useState<LibraryPrinciple[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch('/api/principle-library');
    setRows(r.ok ? (await r.json()).principles : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function send(url: string, method: string, body?: unknown): Promise<string | null> {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) return (await r.json().catch(() => ({}))).error ?? 'Something went wrong';
    load();
    return null;
  }

  if (rows === null) return <div className="h-24 rounded-xl bg-slate-800/40 animate-pulse" />;
  const libraries = [...new Set(rows.map(r => r.library))];
  const sections = [...new Set(rows.map(r => r.section).filter(Boolean))] as string[];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Starting sets Moderators can copy into their Societies, in libraries and sections. Societies keep their own copies, so changes here don&apos;t alter principles already copied.</p>
        <button onClick={() => setAdding(true)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">+ Add principle</button>
      </div>
      {adding && <PrincipleForm saveLabel="Add to library" libraries={libraries} sections={sections} onCancel={() => setAdding(false)}
        onSave={async v => { const err = await send('/api/admin/principle-library', 'POST', v); if (!err) setAdding(false); return err; }} />}
      {libraries.map(lib => (
        <div key={lib} className="space-y-3">
          <h3 className="text-base font-semibold text-slate-100">{lib} library</h3>
          {[...new Set(rows.filter(r => r.library === lib).map(r => r.section || 'Other'))].map(sec => (
            <div key={sec}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{sec}</p>
              <ol className="space-y-2">
                {rows.filter(r => r.library === lib && (r.section || 'Other') === sec).map(p => (
                  <li key={p.id} className="rounded-xl border border-slate-800 bg-dr-card p-4">
                    {editing === p.id ? (
                      <PrincipleForm initial={{ ...p, section: p.section ?? '' }} libraries={libraries} sections={sections} onCancel={() => setEditing(null)}
                        onSave={async v => { const err = await send(`/api/admin/principle-library/${p.id}`, 'PATCH', v); if (!err) setEditing(null); return err; }} />
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <span className={`mr-2 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${CATEGORY_META[p.category].cls}`}>{CATEGORY_META[p.category].label}</span>
                          <span className="text-sm font-semibold text-slate-100">{p.title}</span>
                          <p className="mt-1 text-sm text-slate-300">{p.body}</p>
                          {p.grounding && <p className="mt-1 text-xs text-slate-500">Why: {p.grounding}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1 text-xs">
                          <button onClick={() => setEditing(p.id)} className="text-slate-400 hover:text-slate-200">Edit</button>
                          <button onClick={() => { if (confirm(`Delete "${p.title}" from the library?`)) send(`/api/admin/principle-library/${p.id}`, 'DELETE'); }} className="text-rose-400 hover:text-rose-300">Delete</button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Moderator requests ───────────────────────────────────────────────────────
// Moderator is the paid role; until billing launches, users request it here.
type ModRequest = {
  id: string; status: 'pending' | 'approved' | 'rejected'; message: string | null;
  created_at: string; decided_at: string | null;
  user_handle: string; user_full_name: string | null; user_tier: string;
};

function ModeratorRequestsTab() {
  const [rows, setRows] = useState<ModRequest[] | null>(null);
  const load = useCallback(async () => {
    const r = await fetch('/api/admin/moderator-requests');
    setRows(r.ok ? (await r.json()).requests : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(id: string, action: 'approve' | 'reject') {
    await fetch('/api/admin/moderator-requests', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }),
    });
    load();
  }

  if (rows === null) return <div className="h-24 rounded-xl bg-slate-800/40 animate-pulse" />;
  const pending = rows.filter(r => r.status === 'pending');
  const decided = rows.filter(r => r.status !== 'pending');
  const when = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">People asking to become Moderators. Approving gives them Moderator tools at once (billing isn&apos;t live yet).</p>
      {pending.length === 0 ? (
        <p className="rounded-xl border border-slate-800 bg-dr-card p-6 text-center text-sm text-slate-500">No pending requests.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map(r => (
            <li key={r.id} className="rounded-xl border border-slate-800 bg-dr-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-slate-200">{r.user_full_name || `@${r.user_handle}`} <span className="text-xs text-slate-500">· @{r.user_handle} · {r.user_tier} · asked {when(r.created_at)}</span></p>
                  {r.message && <p className="mt-1 text-xs text-slate-400 whitespace-pre-line">{r.message}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => decide(r.id, 'approve')} className="rounded-lg bg-emerald-600/80 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500">Approve</button>
                  <button onClick={() => decide(r.id, 'reject')} className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-400 hover:text-slate-200">Decline</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {decided.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-2">Recent decisions</p>
          <ul className="space-y-1 text-xs text-slate-500">
            {decided.map(r => (
              <li key={r.id}>@{r.user_handle}: {r.status === 'approved' ? 'approved' : 'declined'} {r.decided_at ? when(r.decided_at) : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [tab,      setTab]      = useState<AdminTab>('analytics');
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [statsErr, setStatsErr] = useState('');

  // ?tab=customers (e.g. "Edit society" on a society dashboard) opens that tab.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'analytics' || t === 'customers' || t === 'keys' || t === 'moderators' || t === 'library' || t === 'scanning' || t === 'ai' || t === 'privacy' || t === 'apiparties') setTab(t);
  }, []);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => setStatsErr('Failed to load analytics'));
  }, []);

  return (
    <div className="min-h-screen bg-dr-base py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">System Admin</h1>
          <p className="text-sm text-slate-500 mt-0.5">Platform monitoring and moderation</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-8 border-b border-slate-800 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {([
            { id: 'analytics', label: 'Analytics' },
            { id: 'customers', label: 'Societies' },
            { id: 'keys',      label: 'Access Keys' },
            { id: 'moderators', label: 'Moderators' },
            { id: 'library',    label: 'Principles library' },
            { id: 'scanning',   label: 'Scanning' },
            { id: 'ai',         label: 'AI' },
            { id: 'privacy',    label: 'Privacy' },
            { id: 'apiparties', label: 'API Parties' },
          ] as { id: AdminTab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? 'border-blue-500 text-blue-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* What this section is for, and how to use it */}
        <div className="mb-6 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-blue-300">Your role here</p>
          <p className="text-sm leading-relaxed text-slate-300">{TAB_HELP[tab]}</p>
        </div>

        {/* Tab content */}
        {tab === 'analytics' && (
          statsErr ? (
            <p className="text-red-400 text-sm">{statsErr}</p>
          ) : !stats ? (
            <div className="flex justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : (
            <AnalyticsView stats={stats} />
          )
        )}


        {tab === 'customers' && <CustomersTab />}
        {tab === 'keys'      && <AccessKeysTab />}
        {tab === 'moderators' && <ModeratorRequestsTab />}
        {tab === 'library'    && <PrinciplesLibraryTab />}
        {tab === 'scanning'   && <ScanningTab />}
        {tab === 'ai'         && <AiTab />}
        {tab === 'privacy'    && <PrivacyTab />}
        {tab === 'apiparties' && <ApiParties embedded />}

        <div className="text-center mt-10">
          <Link href="/" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
            ← Back to site
          </Link>
        </div>

      </div>
    </div>
  );
}
