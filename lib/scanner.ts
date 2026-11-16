import crypto from 'crypto';
import pool from './db';
import { SCAN_TARGETS, TARGET_BY_TYPE } from './scanTargets';
import { isSealed, openText, sealText } from './societyCrypto';
import { isUnlocked } from './masterKey';
import { debateSealing } from './debateCrypto';

const SCANNER_URL = process.env.SCANNER_URL ?? '';
const SCANNER_KEY = process.env.SCANNER_API_KEY ?? '';

type ScanResult = { flagged: boolean; flags: string[] };

async function callScanner(text: string): Promise<ScanResult | null> {
  if (!SCANNER_URL) return null;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (SCANNER_KEY) headers['X-Api-Key'] = SCANNER_KEY;
    const res = await fetch(`${SCANNER_URL}/moderate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json() as ScanResult;
  } catch {
    return null;
  }
}

const hash = (text: string) => crypto.createHash('md5').update(text).digest('hex');

type Item = {
  type: string; key: string; text: string; societyId: number | null;
  authorId: string | null; resolutionId: string | null; href: string | null;
  raw?: string;  // the stored value, when it is encrypted (private Societies)
};

// Scan one piece of text. Records that this exact text was scanned (so it
// isn't scanned again unless it changes) and raises an alert if flagged.
// Returns true if an alert was raised; null if the scanner was unavailable.
async function scanItem(item: Item): Promise<boolean | null> {
  const result = await callScanner(item.text);
  if (!result) return null;
  // The hash is of what is stored, so unchanged encrypted text isn't rescanned
  const h = hash(item.raw ?? item.text);
  await pool.query(
    `INSERT INTO scanned_content (content_type, content_key, text_hash) VALUES ($1, $2, $3)
     ON CONFLICT (content_type, content_key) DO UPDATE SET text_hash = EXCLUDED.text_hash, scanned_at = now()`,
    [item.type, item.key, h],
  );
  if (!result.flagged) return false;
  // One alert per version of the text
  const flagged = item.text.slice(0, 2000);
  const flaggedHash = hash(flagged);
  const { rows } = await pool.query(
    `SELECT 1 FROM content_alerts WHERE content_type = $1 AND content_key = $2 AND text_hash = $3`,
    [item.type, item.key, flaggedHash],
  );
  if (rows.length) return false;
  const isUuid = /^[0-9a-f-]{36}$/i.test(item.key);
  await pool.query(
    `INSERT INTO content_alerts
       (content_type, content_id, content_key, resolution_id, customer_id, content_href, flagged_text, flags, author_id, text_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9, $10)`,
    [item.type, isUuid ? item.key : null, item.key, item.resolutionId, item.societyId, item.href,
     // A private debate's alert is encrypted even in a public Society
     await sealText(item.societyId, flagged, item.resolutionId && (await debateSealing(item.resolutionId)).sealed || undefined), result.flags, item.authorId, flaggedHash],
  );
  return true;
}

export type ContentType = 'statement_title' | 'statement_description' | 'comment';

// Fire-and-forget scan straight after a debate statement or chat message is
// saved (call without await). Fails silently so scanner outages never block
// anyone; the background sweep catches anything missed.
export async function scanContent(
  text: string,
  contentType: ContentType,
  contentId: string,
  resolutionId: string | null,
  authorId: string | null,
): Promise<void> {
  if (!text.trim() || !SCANNER_URL) return;
  try {
    const { rows: [r] } = resolutionId
      ? await pool.query('SELECT customer_id FROM statements WHERE id = $1', [resolutionId])
      : { rows: [] };
    const statementId = contentType === 'comment'
      ? (await pool.query('SELECT statement_id FROM comments WHERE id = $1', [contentId])).rows[0]?.statement_id ?? null
      : contentId;
    await scanItem({
      type: contentType, key: contentId, text, authorId, resolutionId,
      societyId: r?.customer_id ?? null,
      href: resolutionId ? `/chamber?resolution=${resolutionId}${statementId ? `&statement=${statementId}` : ''}` : null,
    });
  } catch (err) {
    console.error('[scanner]', err);
  }
}

// ── Background sweep ─────────────────────────────────────────────────────────

export type SweepKind = 'interval' | 'daily' | 'manual';

/**
 * Scan text across every kind of content. Normally only new or changed text
 * (anything whose hash differs from what was last scanned); `full` rescans
 * everything, e.g. after the scanner's rules change. Only one sweep runs at a
 * time, across all app processes.
 */
export async function runSweep(kind: SweepKind, opts: { full?: boolean; startedBy?: string | null; limitPerType?: number } = {}) {
  if (!SCANNER_URL) return { skipped: 'Scanner not configured' as const };
  const lock = await pool.connect();
  let runId: string | null = null;
  try {
    const { rows: [l] } = await lock.query(`SELECT pg_try_advisory_lock(hashtext('content-sweep')) AS got`);
    if (!l.got) return { skipped: 'A scan is already running' as const };

    const { rows: [run] } = await pool.query(
      'INSERT INTO scan_runs (kind, started_by) VALUES ($1, $2) RETURNING id', [kind, opts.startedBy ?? null]);
    runId = run.id;
    let scanned = 0, raised = 0, unavailable = 0;
    const limit = opts.limitPerType ?? 5000;

    for (const t of SCAN_TARGETS) {
      const text = `t.${t.column}`;
      const { rows } = await pool.query(
        `SELECT t.${t.idColumn}::text AS key, ${text} AS text, ${t.society} AS society_id, ${t.author} AS author_id,
                ${t.resolution ?? 'NULL::uuid'} AS resolution_id, ${t.href} AS href
         FROM ${t.from}
         LEFT JOIN scanned_content sc ON sc.content_type = $1 AND sc.content_key = t.${t.idColumn}::text
         WHERE ${text} IS NOT NULL AND btrim(${text}) <> '' AND ${text} NOT LIKE '*** content masked%'
           ${isUnlocked() ? '' : `AND ${text} NOT LIKE 'enc_:%'`}
           ${t.where ? `AND ${t.where}` : ''}
           ${opts.full ? '' : `AND sc.text_hash IS DISTINCT FROM md5(${text})`}
         LIMIT ${limit}`,
        [t.type],
      );
      // A few at a time: quick, without swamping the scanner
      for (let i = 0; i < rows.length; i += 4) {
        const results = await Promise.all(rows.slice(i, i + 4).map(async r => scanItem({
          type: t.type, key: r.key, societyId: r.society_id, authorId: r.author_id,
          resolutionId: r.resolution_id, href: r.href,
          // Private Societies' text is stored encrypted: scan the plain text
          ...(isSealed(r.text) ? { text: await openText(r.society_id, r.text), raw: r.text } : { text: r.text }),
        })));
        for (const res of results) {
          if (res === null) unavailable++; else { scanned++; if (res) raised++; }
        }
        if (unavailable > 20 && scanned === 0) throw new Error('The scanner is not responding');
      }
    }
    await pool.query(
      `UPDATE scan_runs SET finished_at = now(), items_scanned = $2, alerts_raised = $3,
              error = CASE WHEN $4::int > 0 THEN $4 || ' items could not be scanned (scanner unavailable)' END
       WHERE id = $1`,
      [runId, scanned, raised, unavailable],
    );
    return { scanned, raised, unavailable };
  } catch (err) {
    if (runId) await pool.query(`UPDATE scan_runs SET finished_at = now(), error = $2 WHERE id = $1`, [runId, String((err as Error).message ?? err).slice(0, 500)]);
    console.error('[scanner sweep]', err);
    return { error: String((err as Error).message ?? err) };
  } finally {
    await lock.query(`SELECT pg_advisory_unlock(hashtext('content-sweep'))`).catch(() => {});
    lock.release();
  }
}

// ── Masking (used by the alert review queue) ─────────────────────────────────

export const MASK = '*** content masked by scanning protection ***';

type Q = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

export async function currentText(q: Q, type: string, key: string): Promise<string | null> {
  const t = TARGET_BY_TYPE.get(type);
  if (!t) return null;
  const { rows: [row] } = await q.query(`SELECT ${t.column} AS txt FROM ${t.table} WHERE ${t.idColumn}::text = $1`, [key]);
  return (row?.txt as string | undefined) ?? null;
}

export async function setText(q: Q, type: string, key: string, text: string) {
  const t = TARGET_BY_TYPE.get(type);
  if (!t) return;
  await q.query(`UPDATE ${t.table} SET ${t.column} = $1 WHERE ${t.idColumn}::text = $2`, [text, key]);
}
