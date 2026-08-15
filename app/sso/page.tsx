import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

const ALLOWED_CLIENTS: Record<string, string> = {
  'voter-care': process.env.VOTER_CARE_URL ?? 'https://voter.care',
};

type Props = { searchParams: Promise<{ client?: string; next?: string }> };

export default async function SSOPage({ searchParams }: Props) {
  const { client, next = '/' } = await searchParams;

  if (!client || !ALLOWED_CLIENTS[client]) {
    redirect('/');
  }

  const session = await getSession().catch(() => null);

  if (!session) {
    const selfUrl = `/sso?client=${encodeURIComponent(client)}&next=${encodeURIComponent(next)}`;
    redirect(`/login?next=${encodeURIComponent(selfUrl)}`);
  }

  const callbackBase = ALLOWED_CLIENTS[client];

  const { rows: [token] } = await pool.query<{ id: string }>(
    `INSERT INTO sso_tokens (user_id, client, redirect_to)
     VALUES ($1::uuid, $2, $3)
     RETURNING id`,
    [session.sub, client, next]
  );

  const callbackUrl = `${callbackBase}/api/sso/callback?token=${encodeURIComponent(token.id)}&next=${encodeURIComponent(next)}`;
  redirect(callbackUrl);
}
