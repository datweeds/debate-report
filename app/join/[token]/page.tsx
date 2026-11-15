import type { Metadata } from 'next';
import Link from 'next/link';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { lookupInvite } from '@/lib/societies';
import AcceptInviteButton from '@/components/societies/AcceptInviteButton';

export const metadata: Metadata = { title: 'Join a Society', robots: { index: false, follow: false } };

// Landing page for a Society invite link a moderator sent.
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, session] = await Promise.all([lookupInvite(token), getSession().catch(() => null)]);

  if (!invite) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-slate-100">This invitation isn&apos;t valid</h1>
        <p className="mt-2 text-sm text-slate-400">It may have expired or been withdrawn. Ask the person who sent it for a new link.</p>
      </div>
    );
  }

  const alreadyMember = session
    ? (await pool.query('SELECT 1 FROM customer_members WHERE customer_id = $1 AND user_id = $2', [invite.customer_id, session.sub])).rows.length > 0
    : false;
  const next = encodeURIComponent(`/join/${token}`);

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">You&apos;re invited to join</p>
      <h1 className="mt-1 text-3xl font-bold text-slate-100">{invite.society_name}</h1>
      {invite.hero_text && <p className="mt-2 text-lg text-slate-300">{invite.hero_text}</p>}
      {invite.hero_image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={invite.hero_image} alt="" className="mt-6 w-full max-h-72 rounded-2xl border border-slate-800 object-cover" />
      )}
      {invite.description && <p className="mt-6 text-sm leading-relaxed text-slate-300 whitespace-pre-line">{invite.description}</p>}

      <div className="mt-8">
        {alreadyMember ? (
          <Link href={`/scotparl?society=${invite.customer_id}`} className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
            You&apos;re a member: go to the Society →
          </Link>
        ) : session ? (
          <AcceptInviteButton token={token} />
        ) : (
          <div className="space-y-3">
            <Link href={`/login?next=${next}`} className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Log in to join</Link>
            <p className="text-xs text-slate-500">
              New to new.vote? <Link href="/pricing" className="text-blue-400 hover:underline">Create an account</Link>, then open this link again.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
