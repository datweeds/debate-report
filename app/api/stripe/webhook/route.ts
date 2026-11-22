import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import stripe from '@/lib/stripe';
import pool from '@/lib/db';
import { APP, syncSubscription } from '@/lib/billing';

// Stripe → new.vote. The Stripe account is shared with poll.voter.care, so events
// for anything that isn't ours are acknowledged and ignored.
export const dynamic = 'force-dynamic';

const subId = (v: string | { id: string } | null | undefined) => (typeof v === 'string' ? v : v?.id ?? null);

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Each event once: Stripe may send it again
  const { rowCount } = await pool.query(
    'INSERT INTO billing_events (id, type) VALUES ($1, $2) ON CONFLICT DO NOTHING', [event.id, event.type]);
  if (!rowCount) return NextResponse.json({ received: true, duplicate: true });

  try {
    let sub: string | null = null;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.async_payment_failed': {
        const s = event.data.object;
        if (s.mode === 'subscription' && s.metadata?.app === APP) sub = subId(s.subscription);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        sub = event.data.object.id;
        break;
      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'invoice.payment_action_required':
        sub = subId(event.data.object.parent?.subscription_details?.subscription);
        break;
      case 'customer.deleted': {
        const id = event.data.object.id;
        await pool.query('UPDATE users SET stripe_customer_id = NULL WHERE stripe_customer_id = $1', [id]);
        await pool.query('UPDATE customers SET stripe_customer_id = NULL WHERE stripe_customer_id = $1', [id]);
        break;
      }
    }
    if (sub) await syncSubscription(sub);   // ignores subscriptions that aren't new.vote's
  } catch (e) {
    // Let Stripe retry: forget we saw it
    await pool.query('DELETE FROM billing_events WHERE id = $1', [event.id]).catch(() => {});
    console.error('[stripe] webhook', event.type, event.id, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  // Keep the seen-list short
  if (Math.random() < 0.02) await pool.query(`DELETE FROM billing_events WHERE received_at < NOW() - INTERVAL '60 days'`).catch(() => {});
  return NextResponse.json({ received: true });
}
