import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

type ArgItem = {
  claim?: string; claim_desc?: string; claim_id?: string | null;
  evidence?: string; evidence_desc?: string; evidence_id?: string | null;
  warrant?: string; warrant_desc?: string; warrant_id?: string | null;
};

type Results = {
  for:       ArgItem[];
  against:   ArgItem[];
  rebuttals: ArgItem[];
};

// item keys like "for-0-claim", "against-2-evidence", "rebuttal-1-warrant"
function parseKey(key: string): { group: 'for' | 'against' | 'rebuttal'; index: number; part: 'claim' | 'evidence' | 'warrant' } | null {
  const m = key.match(/^(for|against|rebuttal)-(\d+)-(claim|evidence|warrant)$/);
  if (!m) return null;
  return { group: m[1] as 'for' | 'against' | 'rebuttal', index: parseInt(m[2]), part: m[3] as 'claim' | 'evidence' | 'warrant' };
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: statementId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const userId: string = session.sub;

  const body = await req.json();
  const { sessionId, items }: { sessionId: string; items: string[] } = body;

  if (!sessionId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Missing sessionId or items' }, { status: 400 });
  }

  // Load session
  const { rows: [sess] } = await pool.query(
    'SELECT id, results, statement_id, resolution_id FROM ai_arg_sessions WHERE id = $1 AND user_id = $2',
    [sessionId, userId],
  );
  if (!sess) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const results: Results = sess.results;
  const resolutionId: string = sess.resolution_id ?? statementId;

  // Get statement type (to validate allowed children)
  const { rows: [stmt] } = await pool.query(
    'SELECT stat_type FROM statements WHERE id = $1',
    [statementId],
  );
  if (!stmt) return NextResponse.json({ error: 'Statement not found' }, { status: 404 });

  // Process items: claims first, then evidence+warrants (which depend on claims)
  const claimKeys   = items.filter(k => k.endsWith('-claim'));
  const nonClaimKeys = items.filter(k => !k.endsWith('-claim'));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Created statement ID cache: key → created id
    const idCache = new Map<string, string>();

    async function createStmt(
      title: string, desc: string | undefined | null, type: string,
      direction: string | null, parentId: string,
    ): Promise<string> {
      const { rows: [created] } = await client.query(
        `INSERT INTO statements (stat_type, stat_title, stat_description, stat_direction, resolution_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [type, title.trim(), desc?.trim() || null, direction, resolutionId, userId],
      );
      await client.query(
        'INSERT INTO stat_relationships (stat_id_supported, stat_id_supported_by, created_by) VALUES ($1, $2, $3)',
        [parentId, created.id, userId],
      );
      return created.id;
    }

    function getGroup(group: 'for' | 'against' | 'rebuttal', index: number): ArgItem | null {
      if (group === 'for')       return results.for[index]       ?? null;
      if (group === 'against')   return results.against[index]   ?? null;
      if (group === 'rebuttal')  return results.rebuttals[index] ?? null;
      return null;
    }

    function setId(group: 'for' | 'against' | 'rebuttal', index: number, part: 'claim' | 'evidence' | 'warrant', newId: string) {
      const arr = group === 'for' ? results.for : group === 'against' ? results.against : results.rebuttals;
      if (arr[index]) (arr[index] as Record<string, string | null>)[`${part}_id`] = newId;
    }

    // Create claims first
    for (const key of claimKeys) {
      const parsed = parseKey(key);
      if (!parsed) continue;
      const { group, index, part } = parsed; // part === 'claim'
      const item = getGroup(group, index);
      if (!item?.claim) continue;

      // Skip if already created
      if (item.claim_id) { idCache.set(key, item.claim_id); continue; }

      const statType  = group === 'rebuttal' ? 'rebuttal' : 'claim';
      const direction = group === 'for' ? 'for' : group === 'against' ? 'against' : null;
      const newId = await createStmt(item.claim, item.claim_desc, statType, direction, statementId);
      setId(group, index, part, newId);
      idCache.set(`${group}-${index}-claim`, newId);
    }

    // Create warrants first (parented to their claim), then evidence (parented to warrant)
    const warrantKeys  = nonClaimKeys.filter(k => k.endsWith('-warrant'));
    const evidenceKeys = nonClaimKeys.filter(k => k.endsWith('-evidence'));

    for (const key of warrantKeys) {
      const parsed = parseKey(key);
      if (!parsed) continue;
      const { group, index } = parsed;
      const item = getGroup(group, index);
      if (!item?.warrant || item.warrant_id) continue;
      const claimKey = `${group}-${index}-claim`;
      const parentId = idCache.get(claimKey) ?? item.claim_id ?? statementId;
      const newId = await createStmt(item.warrant, item.warrant_desc, 'warrant', null, parentId);
      setId(group, index, 'warrant', newId);
      idCache.set(`${group}-${index}-warrant`, newId);
    }

    for (const key of evidenceKeys) {
      const parsed = parseKey(key);
      if (!parsed) continue;
      const { group, index } = parsed;
      const item = getGroup(group, index);
      if (!item?.evidence || item.evidence_id) continue;
      // Evidence is parented to warrant (if available), then claim, then statement
      const warrantKey = `${group}-${index}-warrant`;
      const claimKey   = `${group}-${index}-claim`;
      const parentId   = idCache.get(warrantKey) ?? item.warrant_id
                      ?? idCache.get(claimKey)   ?? item.claim_id
                      ?? statementId;
      const newId = await createStmt(item.evidence, item.evidence_desc, 'evidence', null, parentId);
      setId(group, index, 'evidence', newId);
    }

    // Update session with new IDs
    await client.query(
      'UPDATE ai_arg_sessions SET results = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(results), sessionId],
    );

    await client.query('COMMIT');
    return NextResponse.json({ results });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Argue create error:', err);
    return NextResponse.json({ error: 'Failed to create statements' }, { status: 500 });
  } finally {
    client.release();
  }
}
