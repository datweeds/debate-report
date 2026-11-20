'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { useAuth } from '@/components/AuthProvider';
import NotificationSettings from '@/components/NotificationSettings';
import SecureAccessCard from '@/components/sealed/SecureAccessCard';
import RecoveryCodeCard from '@/components/RecoveryCodeCard';

// Voter and Debater are free; only Moderator is paid. (Earlier prices kept in
// comments in case paid Voter/Debater tiers return: Voter £2, Debater £4.)
const TIER_INFO: Record<string, { label: string; monthly: number; annual: number; color: string; desc: string }> = {
  follower:  { label: 'Follower',  monthly: 0, annual: 0,    color: 'text-slate-300',   desc: 'Read debates and follow Societies' },
  voter:     { label: 'Voter',     monthly: 0, annual: 0,    color: 'text-blue-300',    desc: 'Vote and comment' },
  debater:   { label: 'Debater',   monthly: 0, annual: 0,    color: 'text-amber-300',   desc: 'Write statements and arguments' },
  moderator: { label: 'Moderator', monthly: 9, annual: 6.75, color: 'text-emerald-300', desc: 'Run Societies and their debates' },
};
const FREE_TIERS = ['follower', 'voter', 'debater'];

const BIO_MAX = 200;

interface Passkey {
  id: string;
  deviceType: string | null;
  backedUp: boolean;
  transports: string[] | null;
  createdAt: string;
  lastUsedAt: string | null;
}

interface Profile {
  id: string;
  user_handle: string;
  user_full_name: string | null;
  user_bio: string | null;
  bio_public: boolean;
  email: string | null;
  newsletter: boolean;
  user_tier: string;
  passkeys: Passkey[];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-dr p-6">
      <h2 className="text-sm font-semibold text-slate-200 mb-5">{title}</h2>
      {children}
    </div>
  );
}

function SaveButton({ loading, saved }: { loading: boolean; saved: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
    >
      {loading ? 'Saving…' : saved ? (
        <>
          <svg className="h-4 w-4 text-emerald-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          Saved
        </>
      ) : 'Save changes'}
    </button>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-slate-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-600'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </label>
  );
}

function Initials({ handle, name }: { handle: string; name: string | null }) {
  const letters = name
    ? name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : handle.slice(0, 2).toUpperCase();
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/20 border border-blue-500/30 text-xl font-bold text-blue-300 select-none">
      {letters}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function deviceLabel(pk: Passkey) {
  const parts: string[] = [];
  if (pk.deviceType === 'multiDevice') parts.push('Synced passkey');
  else if (pk.deviceType === 'singleDevice') parts.push('Device-bound passkey');
  else parts.push('Passkey');
  if (pk.backedUp) parts.push('· backed up');
  return parts.join(' ');
}

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Identity fields
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio]                 = useState('');
  const [bioPublic, setBioPublic]     = useState(false);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identitySaved, setIdentitySaved]   = useState(false);
  const [identityError, setIdentityError]   = useState('');

  // Username
  const [userHandle,       setUserHandle]       = useState('');
  const [userHandleSaving, setUserHandleSaving] = useState(false);
  const [userHandleSaved,  setUserHandleSaved]  = useState(false);
  const [userHandleError,  setUserHandleError]  = useState('');

  // Account fields
  const [email, setEmail]           = useState('');
  const [newsletter, setNewsletter] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountSaved, setAccountSaved]   = useState(false);
  const [accountError, setAccountError]   = useState('');

  // Plan
  const [tier, setTier]             = useState('follower');
  const [tierSaving, setTierSaving] = useState(false);
  const [tierSaved, setTierSaved]   = useState(false);
  const [tierError, setTierError]   = useState('');

  // Passkeys
  const [passkeys, setPasskeys]           = useState<Passkey[]>([]);
  const [revoking, setRevoking]           = useState<string | null>(null);
  const [revokeError, setRevokeError]     = useState('');
  const [adding, setAdding]               = useState(false);
  const [addError, setAddError]           = useState('');
  const [added, setAdded]                 = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/profile');
    if (res.status === 401) { router.push('/login?next=/profile'); return; }
    const data: Profile = await res.json();
    setProfile(data);
    setDisplayName(data.user_full_name ?? '');
    setBio(data.user_bio ?? '');
    setBioPublic(data.bio_public);
    setUserHandle(data.user_handle);
    setEmail(data.email ?? '');
    setNewsletter(data.newsletter);
    setTier(data.user_tier);
    setPasskeys(data.passkeys);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  // Redirect if not logged in (belt-and-braces)
  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/profile');
  }, [loading, user, router]);

  async function saveIdentity(e: React.FormEvent) {
    e.preventDefault();
    setIdentityError(''); setIdentitySaved(false);
    if (bio.length > BIO_MAX) { setIdentityError(`Bio must be ${BIO_MAX} characters or fewer`); return; }
    setIdentitySaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, bio, bioPublic }),
      });
      const data = await res.json();
      if (!res.ok) { setIdentityError(data.error || 'Save failed'); return; }
      setIdentitySaved(true);
      setTimeout(() => setIdentitySaved(false), 3000);
    } catch { setIdentityError('Something went wrong'); }
    finally { setIdentitySaving(false); }
  }

  async function saveUsername(e: React.FormEvent) {
    e.preventDefault();
    setUserHandleError(''); setUserHandleSaved(false);
    if (userHandle.trim() === profile?.user_handle) {
      setUserHandleSaved(true); setTimeout(() => setUserHandleSaved(false), 2000); return;
    }
    setUserHandleSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userHandle }),
      });
      const data = await res.json();
      if (!res.ok) { setUserHandleError(data.error || 'Save failed'); return; }
      // Update local profile state and refresh header
      setProfile(p => p ? { ...p, user_handle: data.userHandle } : p);
      await refresh();
      setUserHandleSaved(true);
      setTimeout(() => setUserHandleSaved(false), 3000);
    } catch { setUserHandleError('Something went wrong'); }
    finally { setUserHandleSaving(false); }
  }

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    setAccountError(''); setAccountSaved(false);
    setAccountSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newsletter }),
      });
      const data = await res.json();
      if (!res.ok) { setAccountError(data.error || 'Save failed'); return; }
      setAccountSaved(true);
      setTimeout(() => setAccountSaved(false), 3000);
    } catch { setAccountError('Something went wrong'); }
    finally { setAccountSaving(false); }
  }

  async function saveTier(e: React.FormEvent) {
    e.preventDefault();
    setTierError(''); setTierSaved(false);
    if (tier === profile?.user_tier) { setTierSaved(true); setTimeout(() => setTierSaved(false), 2000); return; }
    setTierSaving(true);
    try {
      const res = await fetch('/api/user/tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (!res.ok) { setTierError(data.error || 'Save failed'); return; }
      await refresh();
      setProfile(p => p ? { ...p, user_tier: tier } : p);
      setTierSaved(true);
      setTimeout(() => setTierSaved(false), 3000);
    } catch { setTierError('Something went wrong'); }
    finally { setTierSaving(false); }
  }

  async function revokePasskey(id: string) {
    if (passkeys.length === 1) {
      if (!confirm('This is your only passkey. You can still log in with your recovery code, but you won\'t be able to use biometrics. Revoke anyway?')) return;
    }
    setRevoking(id); setRevokeError('');
    try {
      const res = await fetch(`/api/auth/passkey/devices/${id}`, { method: 'DELETE' });
      if (!res.ok) { setRevokeError('Failed to revoke passkey'); return; }
      setPasskeys(ps => ps.filter(p => p.id !== id));
    } catch { setRevokeError('Something went wrong'); }
    finally { setRevoking(null); }
  }

  async function addPasskey() {
    setAddError(''); setAdded(false);
    if (!browserSupportsWebAuthn()) { setAddError('This browser does not support passkeys'); return; }
    setAdding(true);
    try {
      const optRes = await fetch('/api/auth/passkey/add-options', { method: 'POST' });
      const optData = await optRes.json();
      if (!optRes.ok) { setAddError(optData.error ?? 'Could not start passkey setup'); return; }

      let credential;
      try {
        credential = await startRegistration({ optionsJSON: optData });
      } catch (err) {
        const name = (err as { name?: string }).name;
        if (name === 'InvalidStateError') setAddError('This device already has a passkey for your account');
        else if (name !== 'NotAllowedError') setAddError('Passkey setup failed');
        return; // NotAllowedError = user cancelled
      }

      const verRes = await fetch('/api/auth/passkey/add-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      });
      const verData = await verRes.json();
      if (!verRes.ok) { setAddError(verData.error ?? 'Passkey setup failed'); return; }

      // Refresh just the passkey list (leave any unsaved form edits alone)
      const res = await fetch('/api/profile');
      if (res.ok) setPasskeys(((await res.json()) as Profile).passkeys);
      setAdded(true);
      setTimeout(() => setAdded(false), 3000);
    } catch { setAddError('Something went wrong'); }
    finally { setAdding(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dr-base flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!profile) return null;

  const tierInfo = TIER_INFO[profile.user_tier] ?? TIER_INFO.follower;

  return (
    <div className="min-h-screen bg-dr-base px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-5">

        {/* Page header */}
        <div className="flex items-center gap-4 mb-2">
          <Initials handle={profile.user_handle} name={profile.user_full_name} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-100">{profile.user_full_name || profile.user_handle}</h1>
              {user?.isSysAdmin && (
                <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">
                  sysadmin
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">@{profile.user_handle}</p>
            <span className={`text-xs font-medium ${tierInfo.color}`}>{tierInfo.label}</span>
          </div>
        </div>

        {/* ── Identity ─────────────────────────────────── */}
        <Section title="Your identity">
          <form onSubmit={saveIdentity} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Display name <span className="text-slate-600">(optional)</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="e.g. Alice or The Pragmatist"
                className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Short bio <span className="text-slate-600">(optional)</span>
              </label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="A sentence or two about your perspective or interests…"
                rows={3}
                maxLength={BIO_MAX + 10}
                className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
              <p className={`mt-0.5 text-right text-xs ${bio.length > BIO_MAX ? 'text-red-400' : 'text-slate-600'}`}>
                {bio.length}/{BIO_MAX}
              </p>
            </div>
            <Toggle checked={bioPublic} onChange={setBioPublic} label="Show bio publicly on my profile" />
            {identityError && <p className="text-xs text-red-400">{identityError}</p>}
            <div className="pt-1">
              <SaveButton loading={identitySaving} saved={identitySaved} />
            </div>
          </form>
        </Section>

        {/* ── Username ─────────────────────────────────── */}
        <Section title="Username">
          <form onSubmit={saveUsername} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Username</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 select-none">@</span>
                  <input
                    type="text"
                    value={userHandle}
                    onChange={e => setUserHandle(e.target.value)}
                    placeholder="your_username"
                    autoComplete="username"
                    className="w-full rounded-lg border border-slate-700 bg-dr-surface pl-7 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <SaveButton loading={userHandleSaving} saved={userHandleSaved} />
              </div>
              <p className="mt-1 text-xs text-slate-600">Letters, numbers, _ and - only. Shown publicly on all your contributions.</p>
            </div>
            {userHandleError && <p className="text-xs text-red-400">{userHandleError}</p>}
          </form>
        </Section>

        {/* ── Account ──────────────────────────────────── */}
        <Section title="Account">
          <form onSubmit={saveAccount} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Email <span className="text-slate-600">(optional — newsletter only)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <Toggle
              checked={newsletter}
              onChange={setNewsletter}
              label="Subscribe to the new.vote newsletter"
            />
            {!email && newsletter && (
              <p className="text-xs text-amber-400">Add an email address to receive the newsletter.</p>
            )}
            {accountError && <p className="text-xs text-red-400">{accountError}</p>}
            <div className="pt-1">
              <SaveButton loading={accountSaving} saved={accountSaved} />
            </div>
          </form>
        </Section>

        {/* ── Plan ─────────────────────────────────────── */}
        <Section title="Your plan">
          <form onSubmit={saveTier} className="space-y-4">
            {profile.user_tier === 'moderator' ? (
              <p className="text-sm text-slate-300">
                You&apos;re a <span className="font-semibold text-emerald-300">Moderator</span>: you can create and run Societies.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {FREE_TIERS.map(id => {
                    const info = TIER_INFO[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTier(id)}
                        className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                          tier === id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <p className={`text-sm font-medium ${info.color}`}>{info.label} · Free</p>
                        <p className="text-xs text-slate-500 mt-0.5">{info.desc}</p>
                      </button>
                    );
                  })}
                </div>
                {tierError && <p className="text-xs text-red-400">{tierError}</p>}
                <SaveButton loading={tierSaving} saved={tierSaved} />
              </>
            )}
          </form>
          {profile.user_tier !== 'moderator' && <ModeratorRequest />}
          <p className="mt-4 text-xs text-slate-600">
            <Link href="/pricing" className="text-blue-500 hover:text-blue-400 underline underline-offset-2">What each plan includes</Link>
          </p>
        </Section>

        <NotificationSettings />

        {/* ── Security / Passkeys ───────────────────────── */}
        <Section title="Passkeys & security">
          {revokeError && <p className="text-xs text-red-400 mb-3">{revokeError}</p>}
          {passkeys.length === 0 ? (
            <p className="text-sm text-slate-500">No passkeys registered yet. Add one to log in with Face ID, fingerprint or a security key.</p>
          ) : (
            <ul className="space-y-3">
              {passkeys.map(pk => (
                <li key={pk.id} className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-dr-surface/50 px-4 py-3">
                  <div>
                    <p className="text-sm text-slate-200">{deviceLabel(pk)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Added {formatDate(pk.createdAt)}
                      {pk.lastUsedAt && ` · Last used ${formatDate(pk.lastUsedAt)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => revokePasskey(pk.id)}
                    disabled={revoking === pk.id}
                    className="ml-4 shrink-0 rounded px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    {revoking === pk.id ? 'Revoking…' : 'Revoke'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={addPasskey}
              disabled={adding}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
            >
              {adding ? 'Waiting for device…' : '+ Add a passkey'}
            </button>
            {added && <span className="text-xs text-emerald-400">✓ Passkey added</span>}
            {addError && <span className="text-xs text-red-400">{addError}</span>}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Use this device, or choose another option in the prompt to use your phone or a security key.
          </p>
          <RecoveryCodeCard />
        </Section>

        <SecureAccessCard passkeyCount={passkeys.length} />

      </div>
    </div>
  );
}

// Moderator is the paid role; while billing isn't live, it's requested and a
// SysAdmin approves it.
function ModeratorRequest() {
  const [status, setStatus] = useState<'loading' | 'none' | 'pending' | 'rejected' | 'open' | 'sending'>('loading');
  const [message, setMessage] = useState('');
  useEffect(() => {
    fetch('/api/user/moderator-request').then(r => r.ok ? r.json() : null)
      .then(d => setStatus(d?.request?.status === 'pending' ? 'pending' : d?.request?.status === 'rejected' ? 'rejected' : 'none'))
      .catch(() => setStatus('none'));
  }, []);
  async function send() {
    setStatus('sending');
    const r = await fetch('/api/user/moderator-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }),
    });
    setStatus(r.ok ? 'pending' : 'open');
  }
  if (status === 'loading') return null;
  return (
    <div className="mt-5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4">
      <p className="text-sm font-semibold text-emerald-300">Moderator · £9/month <span className="font-normal text-slate-400">(free while in preview)</span></p>
      <p className="text-xs text-slate-400 mt-1">Create and run your own public and private Societies: debates, votes, discussions, documents, events, projects and principles.</p>
      {status === 'pending' ? (
        <p className="mt-3 text-xs text-amber-300">Your request is with the platform team. You&apos;ll get Moderator tools as soon as it&apos;s approved.</p>
      ) : status === 'open' || status === 'sending' ? (
        <div className="mt-3 space-y-2">
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} maxLength={1000}
            placeholder="Optional: what Society would you like to run?"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-600" />
          <button onClick={send} disabled={status === 'sending'} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
            {status === 'sending' ? 'Sending…' : 'Send request'}
          </button>
        </div>
      ) : (
        <>
          {status === 'rejected' && <p className="mt-2 text-xs text-slate-500">Your last request wasn&apos;t approved. You can ask again.</p>}
          <button onClick={() => setStatus('open')} className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500">
            Request Moderator access
          </button>
        </>
      )}
    </div>
  );
}
