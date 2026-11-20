// Members deleting their own account. Server-only.
//
// What's personal goes: profile, email, sign-in methods (passkeys, Nostr key,
// password), memberships, personal tasks and categories, notification
// settings, keys, responses, favourites and requests. What they contributed to
// shared spaces (arguments in debates, discussion posts, documents, votes)
// stays where it is so other people's replies still make sense, but it's no
// longer linked to them: the account becomes an anonymous "deleted-…" handle
// with no name, email or way to sign in.

import crypto from 'crypto';
import pool from './db';
import stripe from './stripe';

export const ACCOUNT_SENTENCE = 'I CONFIRM TO DELETE MY ACCOUNT UNDERSTANDING IT CANNOT BE UNDONE';
export const accountSentenceMatches = (v: unknown) =>
  typeof v === 'string' && v.trim().replace(/\s+/g, ' ').toUpperCase() === ACCOUNT_SENTENCE;

// Text-typed user ids with no foreign key to users: removed by hand
const UNLINKED: [string, string][] = [
  ['customer_members', 'user_id'], ['customer_roles', 'user_id'], ['debate_join_requests', 'user_id'], ['debate_members', 'user_id'],
  ['nsp_principle_favs', 'user_id'], ['nsp_review_requests', 'user_id'], ['proposal_favs', 'user_id'], ['sp_bill_favs', 'user_id'],
  ['topic_owners', 'user_id'], ['society_join_requests', 'user_id'],
];
// Rows found by email address
const BY_EMAIL: [string, string][] = [['debate_invitations', 'invitee_email'], ['blog_subscribers', 'email']];

export type Blocker = { message: string; societyId?: number };

/** Reasons the account can't be deleted yet (empty when it can). */
export async function accountBlockers(userId: string): Promise<Blocker[]> {
  const out: Blocker[] = [];
  const { rows: [u] } = await pool.query('SELECT is_sys_admin FROM users WHERE id = $1', [userId]);
  if (!u) return [{ message: 'Account not found' }];
  if (u.is_sys_admin) {
    const { rows: [o] } = await pool.query(
      `SELECT count(*)::int AS n FROM users WHERE is_sys_admin AND user_status = 'active' AND id <> $1`, [userId]);
    if (!o.n) out.push({ message: 'You’re the only Sys Admin. Make someone else a Sys Admin first, so the site isn’t left without one.' });
  }
  // Societies that would be left with no Society Admin (the site's default and demo ones are run by Sys Admins)
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.status FROM customers c JOIN customer_roles r ON r.tenant_id = c.id AND r.user_id = $1 AND r.role = 'customer_admin'
     WHERE NOT c.is_default AND NOT c.is_demo
       AND NOT EXISTS (SELECT 1 FROM customer_roles o WHERE o.tenant_id = c.id AND o.role = 'customer_admin' AND o.user_id <> $1
                         AND EXISTS (SELECT 1 FROM users ou WHERE ou.id::text = o.user_id AND ou.user_status = 'active'))
     ORDER BY c.name`, [userId]);
  for (const c of rows) {
    out.push({
      societyId: c.id,
      message: `You’re the only Society Admin of “${c.name}”${c.status === 'closed' ? ' (closed)' : ''}. Make another member a Society Admin, or delete the Society, first.`,
    });
  }
  return out;
}

/** Delete the account as described above. Call accountBlockers first. */
export async function deleteAccount(userId: string): Promise<{ handle: string }> {
  const { rows: [u] } = await pool.query(
    'SELECT user_handle, email, stripe_sub_id, stripe_sub_status FROM users WHERE id = $1', [userId]);
  if (!u) throw new Error('Not found');

  // A paid plan stops first, so nothing is charged after the account has gone
  if (u.stripe_sub_id && !['canceled', 'incomplete_expired'].includes(u.stripe_sub_status ?? '')) {
    try {
      await stripe.subscriptions.cancel(u.stripe_sub_id);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'resource_missing') throw new Error('Couldn’t cancel your subscription. Please try again, or contact us.');
    }
  }

  const client = await pool.connect();
  const handle = `deleted-${crypto.randomBytes(5).toString('hex')}`;
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', 'admin', true)");
    await client.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);

    // Everything that would go with the account if its row were deleted
    const { rows: cascades } = await client.query(
      `SELECT c.conrelid::regclass::text AS t, a.attname AS col FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
       WHERE c.contype = 'f' AND c.confrelid = 'users'::regclass AND c.confdeltype = 'c' AND array_length(c.conkey, 1) = 1`);
    for (const { t, col } of cascades) await client.query(`DELETE FROM ${t} WHERE "${col}" = $1`, [userId]);
    for (const [t, col] of UNLINKED) await client.query(`DELETE FROM ${t} WHERE "${col}" = $1`, [userId]);
    if (u.email) for (const [t, col] of BY_EMAIL) await client.query(`DELETE FROM ${t} WHERE lower("${col}") = lower($1)`, [u.email]);

    // The account itself: anonymous, with no way to sign in
    await client.query(
      `UPDATE users SET user_handle = $2, email = NULL, nostr_npub = NULL, access_code = NULL,
         password_hash = $3, user_full_name = NULL, user_bio = NULL, user_mobile = NULL, user_country = NULL,
         bio_public = false, newsletter = false, is_sys_admin = false, is_scotparl_mod = false,
         user_tier = 'follower', user_plan = 'free', user_status = 'closed',
         stripe_customer_id = NULL, stripe_sub_id = NULL, stripe_sub_status = NULL, stripe_price_id = NULL, stripe_period_end = NULL,
         user_job = NULL, user_job_status = NULL, updated_at = now()
       WHERE id = $1`,
      // Not a bcrypt hash, so no password can ever match it (the table needs some sign-in value)
      [userId, handle, `!deleted:${crypto.randomBytes(16).toString('hex')}`]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  console.log(`[account] ${userId} (@${u.user_handle}) deleted their account; now @${handle}`);
  return { handle };
}
