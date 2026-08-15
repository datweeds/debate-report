import pool from './db';

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

export type ContentType = 'statement_title' | 'statement_description' | 'comment';

// Fire-and-forget: call without await in route handlers.
// Fails silently so scanner outages never block user requests.
export async function scanContent(
  text: string,
  contentType: ContentType,
  contentId: string,
  resolutionId: string | null,
  authorId: string | null,
): Promise<void> {
  if (!text.trim() || !SCANNER_URL) return;
  try {
    const result = await callScanner(text);
    if (!result?.flagged) return;
    await pool.query(
      `INSERT INTO content_alerts
         (content_type, content_id, resolution_id, flagged_text, flags, author_id)
       VALUES ($1, $2, $3, $4, $5::text[], $6)`,
      [contentType, contentId, resolutionId, text.slice(0, 2000), result.flags, authorId],
    );
  } catch (err) {
    console.error('[scanner]', err);
  }
}
