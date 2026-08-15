import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import stripe from '@/lib/stripe';
import pool from '@/lib/db';

// Required for reading raw body in Next.js App Router
export const dynamic = 'force-dynamic';

async function setUserPlan(
  customerId: string,
  plan: 'free' | 'paid',
  subId: string | null,
  subStatus: string | null,
  priceId: string | null,
  periodEnd: Date | null
) {
  await pool.query(
    `UPDATE users
     SET user_plan          = $1,
         stripe_sub_id      = $2,
         stripe_sub_status  = $3,
         stripe_price_id    = $4,
         stripe_period_end  = $5,
         updated_at         = NOW()
     WHERE stripe_customer_id = $6`,
    [plan, subId, subStatus, priceId, periodEnd, customerId]
  );
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig     = req.headers.get('stripe-signature');

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature error:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;

        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        const customerId = session.customer as string;

        const item0 = sub.items.data[0];
        await setUserPlan(
          customerId,
          'paid',
          sub.id,
          sub.status,
          item0?.price.id ?? null,
          item0?.current_period_end ? new Date(item0.current_period_end * 1000) : null
        );
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const isActive = ['active', 'trialing'].includes(sub.status);

        const item0 = sub.items.data[0];
        await setUserPlan(
          customerId,
          isActive ? 'paid' : 'free',
          sub.id,
          sub.status,
          item0?.price.id ?? null,
          item0?.current_period_end ? new Date(item0.current_period_end * 1000) : null
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        await setUserPlan(customerId, 'free', null, 'cancelled', null, null);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await pool.query(
          `UPDATE users SET stripe_sub_status = 'past_due', updated_at = NOW()
           WHERE stripe_customer_id = $1`,
          [customerId]
        );
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
