import Stripe from 'stripe';

// Singleton Stripe client — only used server-side
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_placeholder_build_only', {
  apiVersion: '2026-07-29.dahlia',
});

export default stripe;

export const PRICE_IDS = {
  monthly: 'price_1TC6A7HSLN0ovpIdc4mRfeYw',
  annual:  'price_1TC69uHSLN0ovpIdTb7lZVOQ',
} as const;

export const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? 'https://staging.debate.report';
