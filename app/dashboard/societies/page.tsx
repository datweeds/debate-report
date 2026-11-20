'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import SocietyImageField from '@/components/societies/SocietyImageField';
import SocietyAiCard from '@/components/societies/SocietyAiCard';
import FeaturesCard from '@/components/societies/FeaturesCard';
import NewsCard from '@/components/societies/NewsCard';
import WebAddressField from '@/components/societies/WebAddressField';
import AccessLogCard from '@/components/societies/AccessLogCard';

type Visibility = 'public' | 'apply' | 'invite';

type SocietyRow = {
  id: number; name: string; visibility: Visibility; hero_text: string | null;
  member_count: number; pending_requests: number; debate_count: number;
};

type Detail = {
  society: { id: number; name: string; visibility: Visibility; hero_text: string | null; hero_image: string | null; description: string | null; contact_email: string | null; is_default: boolean; disabled_sections: string[]; subdomain: string | null; allow_sealed: boolean };
  members: { user_id: string; joined_at: string; user_handle: string | null; user_full_name: string | null; is_moderator: boolean }[];
  requests: { id: string; user_id: string; message: string | null; created_at: string; user_handle: string | null; user_full_name: string | null }[];
  invites: { id: string; label: string | null; created_at: string; expires_at: string | null; revoked_at: string | null; use_count: number; last_used_at: string | null }[];
  me: string;
};

const VIS_OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: 'public', label: 'Public', hint: 'Anyone can see the Society and its public debates.' },
  { value: 'apply',  label: 'Apply',  hint: 'Listed to everyone. Non-members see a summary and can ask to join; you approve requests.' },
  { value: 'invite', label: 'Invite', hint: 'Hidden. Only people who join through an invite link you send can see it.' },
];

const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-blue-500 focus:outline-none';
const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ManageSocietiesPage() {
  return <Suspense fallback={null}><ManageSocieties /></Suspense>;
}

function ManageSocieties() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get('society') ? Number(params.get('society')) : null;
  const creating = params.get('new') === '1';

  const [list, setList] = useState<{ societies: SocietyRow[]; canCreate: boolean } | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/societies');
  }, [loading, user, router]);

  const loadList = useCallback(async () => {
    const r = await fetch('/api/manage/societies');
    setList(r.ok ? await r.json() : { societies: [], canCreate: false });
  }, []);
  useEffect(() => { if (user) loadList(); }, [user, loadList]);

  // Open the first Society by default
  useEffect(() => {
    if (list && !selected && !creating && list.societies.length) {
      router.replace(`/dashboard/societies?society=${list.societies[0].id}`);
    }
  }, [list, selected, creating, router]);

  if (loading || !user) return null;

  return (
    <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Manage Societies</h1>
        <p className="text-sm text-slate-500 mt-1">Create and run the Societies you moderate: details, who can see them, and their members.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="space-y-2">
          {list === null ? (
            <div className="h-20 rounded-xl bg-slate-800/40 animate-pulse" />
          ) : (
            <>
              {list.societies.map(s => (
                <button key={s.id} onClick={() => router.replace(`/dashboard/societies?society=${s.id}`)}
                  className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                    s.id === selected ? 'border-blue-500/60 bg-blue-500/10' : 'border-slate-800 bg-dr-card hover:border-slate-700'
                  }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-200 truncate">{s.name}</span>
                    {s.pending_requests > 0 && (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">{s.pending_requests}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {VIS_OPTIONS.find(v => v.value === s.visibility)?.label} · {s.member_count} members · {s.debate_count} debates
                  </p>
                </button>
              ))}
              {list.societies.length === 0 && !list.canCreate && (
                <p className="text-sm text-slate-500 rounded-xl border border-slate-800 bg-dr-card p-4">You don&apos;t moderate any Societies.</p>
              )}
              {list.canCreate && (
                <button onClick={() => router.replace('/dashboard/societies?new=1')}
                  className={`w-full rounded-xl border border-dashed px-3 py-2.5 text-sm font-medium transition-colors ${
                    creating ? 'border-blue-500/60 text-blue-300 bg-blue-500/10' : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
                  }`}>
                  + New Society
                </button>
              )}
            </>
          )}
        </aside>

        <section className="min-w-0">
          {creating ? (
            <CreateSociety onCreated={async id => { await loadList(); router.replace(`/dashboard/societies?society=${id}`); }} />
          ) : selected ? (
            <SocietyEditor key={selected} id={selected} onChanged={loadList} />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-dr-card p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function VisibilityPicker({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {VIS_OPTIONS.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
            value === o.value ? 'border-blue-500/60 bg-blue-500/10 text-blue-200' : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500'
          }`}>
          <p className="text-sm font-medium">{o.label}</p>
          <p className="text-xs opacity-75 mt-0.5 leading-snug">{o.hint}</p>
        </button>
      ))}
    </div>
  );
}

function CreateSociety({ onCreated }: { onCreated: (id: number) => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugOk, setSlugOk] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('public');
  // Suggest an address from the name until the moderator types their own
  useEffect(() => {
    if (slugEdited || name.trim().length < 3) return;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/manage/societies/slug?suggest=${encodeURIComponent(name)}`);
      if (r.ok) setSlug((await r.json()).slug);
    }, 300);
    return () => clearTimeout(t);
  }, [name, slugEdited]);
  const [heroText, setHeroText] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    const r = await fetch('/api/manage/societies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug, visibility, hero_text: heroText, description }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) { setError(d.error ?? 'Could not create the Society'); return; }
    onCreated(d.id);
  }

  return (
    <form onSubmit={create}>
      <Card title="New Society">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required minLength={3} maxLength={120} className={inputCls} placeholder="e.g. Edinburgh Climate Forum" />
          </div>
          <WebAddressField value={slug} onChange={v => { setSlug(v); setSlugEdited(true); }} onValidity={setSlugOk}
            note="Choose carefully: this is how members will find and share your Society." />
          <div>
            <label className="block text-xs text-slate-400 mb-1">Who can see it</label>
            <VisibilityPicker value={visibility} onChange={setVisibility} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Hero text <span className="text-slate-600">(one line under the name)</span></label>
            <input value={heroText} onChange={e => setHeroText(e.target.value)} maxLength={300} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5} className={inputCls} />
          </div>
          <p className="text-xs text-slate-500">You&apos;ll be its moderator. You can add an image once it&apos;s created.</p>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <button type="submit" disabled={saving || name.trim().length < 3 || !slugOk}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Society'}
          </button>
        </div>
      </Card>
    </form>
  );
}

function SocietyEditor({ id, onChanged }: { id: number; onChanged: () => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', slug: '', visibility: 'public' as Visibility, hero_text: '', description: '', contact_email: '' });
  const [slugOk, setSlugOk] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [inviteLabel, setInviteLabel] = useState('');
  const [inviteDays, setInviteDays] = useState('30');
  const [copied, setCopied] = useState(false);
  const [rowError, setRowError] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/manage/societies/${id}`);
    if (!r.ok) { setError('You don\'t moderate this Society.'); return; }
    const d: Detail = await r.json();
    setData(d);
    setForm({ name: d.society.name, slug: d.society.subdomain ?? '', visibility: d.society.visibility, hero_text: d.society.hero_text ?? '', description: d.society.description ?? '', contact_email: d.society.contact_email ?? '' });
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (error) return <p className="text-sm text-rose-400">{error}</p>;
  if (!data) return <div className="h-40 rounded-2xl bg-slate-800/40 animate-pulse" />;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false); setRowError('');
    const r = await fetch(`/api/manage/societies/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    setSaving(false);
    if (!r.ok) { setRowError((await r.json()).error ?? 'Save failed'); return; }
    setSaved(true); setTimeout(() => setSaved(false), 3000);
    load(); onChanged();
  }

  async function decide(requestId: string, action: 'approve' | 'reject') {
    await fetch(`/api/manage/societies/${id}/requests`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, action }),
    });
    load(); onChanged();
  }

  async function member(userId: string, action: 'remove' | 'make_moderator' | 'remove_moderator') {
    if (action === 'remove' && !confirm('Remove this member from the Society?')) return;
    setRowError('');
    const r = await fetch(`/api/manage/societies/${id}/members`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, action }),
    });
    if (!r.ok) { setRowError((await r.json()).error ?? 'Could not update member'); return; }
    load(); onChanged();
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch(`/api/manage/societies/${id}/invites`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: inviteLabel, expiresInDays: inviteDays.trim() === '' ? null : Number(inviteDays) }),
    });
    const d = await r.json();
    if (!r.ok) { setRowError(d.error ?? 'Could not create link'); return; }
    setNewLink(`${window.location.origin}${d.path}`);
    setInviteLabel(''); setCopied(false);
    load();
  }

  async function revoke(inviteId: string) {
    if (!confirm('Revoke this invite link? People who already joined stay members.')) return;
    await fetch(`/api/manage/societies/${id}/invites`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inviteId }),
    });
    load();
  }

  const s = data.society;
  const moderatorCount = data.members.filter(m => m.is_moderator).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-100">{s.name}</h2>
        <div className="flex items-center gap-3 text-xs">
          <Link href={`/society/${s.subdomain || s.id}`} className="text-blue-400 hover:underline">View Society →</Link>
        </div>
      </div>
      {rowError && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{rowError}</p>}

      <form onSubmit={save}>
        <Card title="Details" right={saved ? <span className="text-xs text-emerald-400">✓ Saved</span> : null}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} minLength={3} maxLength={120} className={inputCls} />
            </div>
            <WebAddressField value={form.slug} exceptId={id} onChange={v => setForm(f => ({ ...f, slug: v }))} onValidity={setSlugOk}
              note={form.slug !== (s.subdomain ?? '') ? 'Changing it stops links to the old address working; numbered links still work.' : undefined} />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Who can see it</label>
              <VisibilityPicker value={form.visibility} onChange={v => setForm(f => ({ ...f, visibility: v }))} />
              {s.is_default && form.visibility !== 'public' && (
                <p className="mt-1 text-xs text-amber-400">This is the site&apos;s default Society; making it private will stop it being the default.</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Hero text</label>
              <input value={form.hero_text} onChange={e => setForm(f => ({ ...f, hero_text: e.target.value }))} maxLength={300} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={6} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Contact email <span className="text-slate-600">(messages from the About page go here; never shown publicly)</span></label>
              <input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} type="email" className={inputCls} placeholder="e.g. hello@yoursociety.org" />
            </div>
            <SocietyImageField endpoint={`/api/manage/societies/${id}/image`} value={s.hero_image} onChange={() => load()} />
            <button type="submit" disabled={saving || !slugOk}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save details'}
            </button>
          </div>
        </Card>
      </form>

      <FeaturesCard key={s.id} societyId={s.id} initial={s.disabled_sections ?? []} />

      <NewsCard key={`news-${s.id}`} societyId={s.id} switchedOff={(s.disabled_sections ?? []).includes('news')} />

      <SocietyAiCard societyId={s.id} />

      <AccessLogCard key={`privacy-${s.id}`} societyId={s.id} visibility={s.visibility} allowSealed={!!s.allow_sealed} />

      {(s.visibility === 'apply' || data.requests.length > 0) && (
        <Card title={`Requests to join (${data.requests.length})`}>
          {data.requests.length === 0 ? (
            <p className="text-xs text-slate-500">No pending requests.</p>
          ) : (
            <ul className="space-y-3">
              {data.requests.map(r => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/60 pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200">{r.user_full_name || `@${r.user_handle ?? 'unknown'}`} <span className="text-xs text-slate-500">· {fmt(r.created_at)}</span></p>
                    {r.message && <p className="text-xs text-slate-400 mt-1 whitespace-pre-line">{r.message}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => decide(r.id, 'approve')} className="rounded-lg bg-emerald-600/80 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500">Approve</button>
                    <button onClick={() => decide(r.id, 'reject')} className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-400 hover:text-slate-200">Decline</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card title="Invite links">
        <form onSubmit={createInvite} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[12rem]">
            <label className="block text-xs text-slate-400 mb-1">Who is it for? <span className="text-slate-600">(optional)</span></label>
            <input value={inviteLabel} onChange={e => setInviteLabel(e.target.value)} maxLength={120} className={inputCls} placeholder="e.g. Board members" />
          </div>
          <div className="w-28">
            <label className="block text-xs text-slate-400 mb-1">Expires (days)</label>
            <input value={inviteDays} onChange={e => setInviteDays(e.target.value)} inputMode="numeric" className={inputCls} placeholder="never" />
          </div>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Create link</button>
        </form>
        {newLink && (
          <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-xs text-emerald-300 mb-1">Copy this link now: it can&apos;t be shown again. Anyone who opens it and logs in joins the Society.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-slate-900 px-2 py-1 text-xs text-slate-200">{newLink}</code>
              <button onClick={() => { navigator.clipboard.writeText(newLink); setCopied(true); }}
                className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:border-slate-400">{copied ? 'Copied' : 'Copy'}</button>
            </div>
          </div>
        )}
        {data.invites.length > 0 && (
          <ul className="mt-4 space-y-2">
            {data.invites.map(i => {
              const expired = i.expires_at && new Date(i.expires_at) < new Date();
              const status = i.revoked_at ? 'Revoked' : expired ? 'Expired' : 'Active';
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-slate-300">{i.label || 'Invite link'}</span>
                  <span className={status === 'Active' ? 'text-emerald-400' : 'text-slate-500'}>{status}</span>
                  <span className="text-slate-500">
                    created {fmt(i.created_at)}{i.expires_at ? ` · expires ${fmt(i.expires_at)}` : ' · no expiry'} · used {i.use_count}×
                  </span>
                  {status === 'Active' && (
                    <button onClick={() => revoke(i.id)} className="ml-auto text-rose-400 hover:text-rose-300">Revoke</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title={`Members (${data.members.length})`}>
        <ul className="divide-y divide-slate-800/60">
          {data.members.map(m => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="text-sm text-slate-200">{m.user_full_name || `@${m.user_handle ?? 'unknown'}`}</span>
              {m.is_moderator && <span className="rounded border border-blue-500/40 bg-blue-500/10 px-1.5 text-[10px] font-semibold text-blue-300">Moderator</span>}
              {m.user_id === data.me && <span className="text-[10px] text-slate-500">(you)</span>}
              <span className="text-[11px] text-slate-600">joined {fmt(m.joined_at)}</span>
              <span className="ml-auto flex gap-3 text-xs">
                {m.is_moderator ? (
                  moderatorCount > 1 && <button onClick={() => member(m.user_id, 'remove_moderator')} className="text-slate-400 hover:text-slate-200">Remove moderator</button>
                ) : (
                  <button onClick={() => member(m.user_id, 'make_moderator')} className="text-blue-400 hover:text-blue-300">Make moderator</button>
                )}
                {!(m.is_moderator && moderatorCount === 1) && (
                  <button onClick={() => member(m.user_id, 'remove')} className="text-rose-400 hover:text-rose-300">Remove</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
