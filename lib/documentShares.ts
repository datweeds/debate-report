// Share links for Society documents: rules, tokens and lookup. Server-only.
//
// A moderator shares one file with people outside the Society:
//   public   anyone with the link opens the document (served by us, decrypted
//            here for private Societies)
//   private  a copy encrypted in the moderator's browser with a key that only
//            the link carries (after '#'); we store and serve that copy as it is
// In a private Society a public link must expire, at most 14 days after it was
// made or last extended. Sealed documents can only have private links.

import crypto from 'crypto';
import pool from './db';
import { removeFile } from './documents';

export const PUBLIC_MAX_DAYS_PRIVATE_SOCIETY = 14;
export const MAX_DAYS = 365;
const DAY = 86400_000;

export type ShareMode = 'public' | 'private';

export const newToken = () => crypto.randomBytes(24).toString('base64url');
export const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
export const isToken = (t: string) => /^[A-Za-z0-9_-]{32}$/.test(t);

/** The expiry rule for a new or extended link, or an error message. */
export function expiryFor(mode: ShareMode, privateSociety: boolean, days: unknown): { expiresAt: Date | null } | { error: string } {
  const capped = mode === 'public' && privateSociety;
  if (days == null || days === '' || days === 'never') {
    return capped ? { error: `Public links in a private Society must expire (within ${PUBLIC_MAX_DAYS_PRIVATE_SOCIETY} days)` } : { expiresAt: null };
  }
  const n = Number(days);
  if (!Number.isInteger(n) || n < 1 || n > MAX_DAYS) return { error: 'Choose an expiry' };
  if (capped && n > PUBLIC_MAX_DAYS_PRIVATE_SOCIETY) return { error: `Public links in a private Society can last at most ${PUBLIC_MAX_DAYS_PRIVATE_SOCIETY} days (extend them later if needed)` };
  return { expiresAt: new Date(Date.now() + n * DAY) };
}

export type ShareRow = {
  id: string; document_id: string; customer_id: number; mode: ShareMode; stored_name: string | null; size_bytes: string | null;
  expires_at: Date | null; extended_at: Date | null; created_at: Date; created_by: string | null;
  kind: string; protection: 'server' | 'sealed'; doc_stored_name: string | null; title: string; file_name: string | null; mime_type: string | null; doc_size: string | null;
  visibility: string; disabled_sections: string[] | null; society_name: string; sharer: string | null;
};

/** Whether a link still works: not revoked (checked by the query), not expired, still allowed by the rules. */
export function shareState(s: Pick<ShareRow, 'mode' | 'expires_at' | 'extended_at' | 'created_at' | 'visibility' | 'protection'>): 'ok' | 'expired' | 'not-allowed' {
  if (s.expires_at && s.expires_at.getTime() <= Date.now()) return 'expired';
  if (s.mode === 'public') {
    // Sealed since it was shared: the server can no longer serve it
    if (s.protection === 'sealed') return 'not-allowed';
    // The Society is (or has become) private: public links need a recent expiry
    if (s.visibility !== 'public') {
      const from = (s.extended_at ?? s.created_at).getTime();
      if (!s.expires_at || s.expires_at.getTime() > from + PUBLIC_MAX_DAYS_PRIVATE_SOCIETY * DAY + 60_000) return 'expired';
    }
  }
  return 'ok';
}

/** A live share link by its token, with its document and Society; null if there's no such link. */
export async function shareByToken(token: string): Promise<ShareRow | null> {
  if (!isToken(token)) return null;
  const { rows: [s] } = await pool.query(
    `SELECT s.id, s.document_id, s.customer_id, s.mode, s.stored_name, s.size_bytes, s.expires_at, s.extended_at, s.created_at, s.created_by,
            d.kind, d.protection, d.stored_name AS doc_stored_name, d.title, d.file_name, d.mime_type, d.size_bytes AS doc_size,
            c.visibility, c.disabled_sections, c.name AS society_name, u.user_handle AS sharer
       FROM document_shares s
       JOIN documents d ON d.id = s.document_id AND d.customer_id = s.customer_id AND d.deleted_at IS NULL
       JOIN customers c ON c.id = s.customer_id
       LEFT JOIN users u ON u.id = s.created_by
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL`,
    [hashToken(token)],
  );
  if (!s || (s.disabled_sections ?? []).includes('documents')) return null;
  return s;
}

/** Revoke links (one, or all of a document's), deleting private links' encrypted copies. */
export async function revokeShares(customerId: number, where: { id: string } | { documentId: string }) {
  const { rows } = await pool.query(
    `UPDATE document_shares SET revoked_at = now()
      WHERE customer_id = $1 AND revoked_at IS NULL AND ${'id' in where ? 'id' : 'document_id'} = $2
      RETURNING stored_name`,
    [customerId, 'id' in where ? where.id : where.documentId],
  );
  for (const r of rows) await removeFile(customerId, r.stored_name);
  return rows.length;
}
