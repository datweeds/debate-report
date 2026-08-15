import { NextResponse } from 'next/server';
import stripe, { BASE_URL } from '@/lib/stripe';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows: [user] } = await pool.query(
    'SELECT stripe_customer_id FROM users WHERE id = $1',
    [session.sub]
  );

  if (!user?.stripe_customer_id) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   user.stripe_customer_id,
    return_url: `${BASE_URL}/dashboard`,
  });

  return NextResponse.json({ url: portalSession.url });
}
