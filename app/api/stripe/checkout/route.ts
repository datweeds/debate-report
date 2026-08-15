import { NextRequest, NextResponse } from 'next/server';
import stripe, { PRICE_IDS, BASE_URL } from '@/lib/stripe';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { billing } = await req.json() as { billing: 'monthly' | 'annual' };
  const priceId = billing === 'annual' ? PRICE_IDS.annual : PRICE_IDS.monthly;

  // Fetch user's email and existing Stripe customer ID
  const { rows: [user] } = await pool.query(
    `SELECT email, stripe_customer_id FROM users WHERE id = $1`,
    [session.sub]
  );
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  let customerId = user.stripe_customer_id as string | null;

  // Reuse or create a Stripe customer
  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    user.email ?? undefined,
      metadata: { userId: session.sub, handle: session.handle },
    });
    customerId = customer.id;
    await pool.query(
      'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
      [customerId, session.sub]
    );
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer:             customerId,
    mode:                 'subscription',
    line_items:           [{ price: priceId, quantity: 1 }],
    success_url:          `${BASE_URL}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:           `${BASE_URL}/pricing`,
    client_reference_id:  session.sub,
    subscription_data: {
      metadata: { userId: session.sub },
    },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
