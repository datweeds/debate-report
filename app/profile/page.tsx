'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

const TIER_INFO: Record<string, { label: string; monthly: number; annual: number; color: string }> = {
  follower:  { label: 'Follower',  monthly: 0,    annual: 0,    color: 'text-slate-300' },
  voter:     { label: 'Voter',     monthly: 2,    annual: 1.50, color: 'text-blue-300' },
  debater:   { label: 'Debater',   monthly: 4,    annual: 3,    color: 'text-amber-300' },
  moderator: { label: 'Moderator', monthly: 9,    annual: 6.75, color: 'text-emerald-300' },
};

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
            <h1 className="text-xl font-bold text-slate-100">{profile.user_full_name || profile.user_handle}</h1>
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
              label="Subscribe to the debate.report newsletter"
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
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(TIER_INFO) as [string, typeof TIER_INFO[string]][]).map(([id, info]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTier(id)}
                  className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                    tier === id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <p className={`text-sm font-medium ${info.color}`}>{info.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {info.monthly === 0 ? 'Free' : `£${info.monthly}/mo · £${info.annual}/mo annual`}
                  </p>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600">
              Payment is not collected yet —{' '}
              <Link href="/pricing" className="text-blue-500 hover:text-blue-400 underline underline-offset-2">
                see full plan details
              </Link>
            </p>
            {tierError && <p className="text-xs text-red-400">{tierError}</p>}
            <SaveButton loading={tierSaving} saved={tierSaved} />
          </form>
        </Section>

        {/* ── Security / Passkeys ───────────────────────── */}
        <Section title="Passkeys & security">
          {revokeError && <p className="text-xs text-red-400 mb-3">{revokeError}</p>}
          {passkeys.length === 0 ? (
            <p className="text-sm text-slate-500">No passkeys registered. Log in with your recovery code and add one from a supported device.</p>
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
          <p className="mt-4 text-xs text-slate-600">
            Your recovery code can always be used to log in if you lose access to your passkey device.
            Keep it somewhere safe.
          </p>
        </Section>

      </div>
    </div>
  );
}
