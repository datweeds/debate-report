// External "party" tokens: a partner platform gets one Bearer token, capped to a
// fixed number of distinct external users. Each external user is mapped 1:1 to a
// row in our own `users` table, so statement ownership ("only authors can edit
// their own statements") falls out of the existing created_by check for free.
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import pool from './db';

export interface ApiParty {
  id: string;
  name: string;
  max_users: number;
}

export function generateApiToken(): string {
  return 'nv_' + crypto.randomBytes(32).toString('base64url');
}

export function hashApiToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function getPartyFromRequest(req: NextRequest): Promise<ApiParty | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const raw = auth.slice(7).trim();
  if (!raw) return null;
  const { rows } = await pool.query(
    `SELECT id, name, max_users FROM api_parties WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashApiToken(raw)],
  );
  return rows[0] ?? null;
}

type ResolveResult = { ok: true; userId: string } | { ok: false; status: number; error: string };

// Finds the local user already mapped to this (party, externalUserId) pair.
// Does NOT create one — used by edit/delete, where the author must already exist.
export async function lookupExternalAuthor(partyId: string, externalUserId: string): Promise<string | null> {
  const { rows } = await pool.query(
    'SELECT user_id FROM api_party_users WHERE api_party_id = $1 AND external_user_id = $2',
    [partyId, externalUserId],
  );
  return rows[0]?.user_id ?? null;
}

// Finds or creates (subject to the party's max_users cap) the local user mapped
// to this (party, externalUserId) pair — used only by statement creation.
export async function resolveOrCreateExternalAuthor(
  party: ApiParty,
  externalUserId: string,
  authorName?: string | null,
): Promise<ResolveResult> {
  if (!externalUserId || typeof externalUserId !== 'string') {
    return { ok: false, status: 400, error: 'external_user_id is required' };
  }

  const existing = await lookupExternalAuthor(party.id, externalUserId);
  if (existing) return { ok: true, userId: existing };

  const { rows: countRows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM api_party_users WHERE api_party_id = $1',
    [party.id],
  );
  if (countRows[0].n >= party.max_users) {
    return { ok: false, status: 403, error: `This token is limited to ${party.max_users} participating user(s) and that limit has been reached` };
  }

  const handle = `ext_${party.id.slice(0, 8)}_${externalUserId}`
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .slice(0, 60);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [user] } = await client.query(
      `INSERT INTO users (user_handle, user_full_name, user_tier, terms_agreed)
       VALUES ($1, $2, 'debater', TRUE)
       RETURNING id`,
      [handle, authorName?.toString().trim() || null],
    );
    await client.query(
      'INSERT INTO api_party_users (api_party_id, external_user_id, user_id) VALUES ($1, $2, $3)',
      [party.id, externalUserId, user.id],
    );
    await client.query('COMMIT');
    return { ok: true, userId: user.id };
  } catch (err) {
    await client.query('ROLLBACK');
    // Benign race: two concurrent first-time calls for the same external user.
    // Whichever lost the INSERT race just looks the winner's row up.
    const again = await lookupExternalAuthor(party.id, externalUserId);
    if (again) return { ok: true, userId: again };
    console.error('resolveOrCreateExternalAuthor failed:', err);
    return { ok: false, status: 500, error: 'Database error' };
  } finally {
    client.release();
  }
}
