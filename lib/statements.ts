// Core statement create/update/retract logic, shared by the internal
// (session-authed) and external (/api/v1, token-authed) routes so both
// surfaces enforce identical debate rules and ownership checks.
import pool from './db';
import { scanContent } from './scanner';
import { PF_ALLOWED_CHILDREN, isValidStatType } from './debateRules';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

interface CreateStatementInput {
  resolutionId: string;
  parentId: string;
  statType: string;
  statTitle: string;
  statDirection?: string | null;
  statDescription?: string | null;
  createdBy: string; // users.id
}

export async function createStatement(input: CreateStatementInput): Promise<ApiResult<{ statement: unknown; relationship: unknown }>> {
  const { resolutionId, parentId, statType, statTitle, statDirection, statDescription, createdBy } = input;

  if (!parentId || !resolutionId || !statType || !statTitle?.trim()) {
    return { ok: false, status: 400, error: 'Missing required fields' };
  }
  if (!isValidStatType(statType)) {
    return { ok: false, status: 400, error: 'Invalid statement type' };
  }
  if (statDirection && statDirection !== 'for' && statDirection !== 'against') {
    return { ok: false, status: 400, error: 'Invalid direction' };
  }

  const { rows: [parent] } = await pool.query(
    'SELECT id, stat_type, resolution_id FROM statements WHERE id = $1',
    [parentId],
  );
  if (!parent) return { ok: false, status: 404, error: 'Parent statement not found' };

  // The parent must actually belong to the resolution being posted to (either it IS
  // the resolution, or its resolution_id matches) — internal UI always gets this right
  // by construction, but external callers are untrusted input.
  const parentResolutionId = parent.stat_type === 'resolution' ? parent.id : parent.resolution_id;
  if (parentResolutionId !== resolutionId) {
    return { ok: false, status: 422, error: 'parentId does not belong to resolutionId' };
  }

  const allowed = PF_ALLOWED_CHILDREN[parent.stat_type] ?? [];
  if (!allowed.includes(statType)) {
    return { ok: false, status: 422, error: `A ${statType} cannot be connected to a ${parent.stat_type} under debate rules` };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [statement] } = await client.query(
      `INSERT INTO statements
         (stat_type, stat_title, stat_direction, stat_description, resolution_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, stat_type, stat_title, stat_direction, stat_description,
                 resolution_id, created_by, retracted_at, created_at, stat_ref`,
      [statType, statTitle.trim(), statDirection ?? null, statDescription?.trim() ?? null, resolutionId, createdBy],
    );

    // stat_id_supported = parent (what's being supported)
    // stat_id_supported_by = new child (the supporter)
    await client.query(
      'INSERT INTO stat_relationships (stat_id_supported, stat_id_supported_by, created_by) VALUES ($1, $2, $3)',
      [parentId, statement.id, createdBy],
    );

    await client.query('COMMIT');

    const relationship = { stat_id_supported: parentId, stat_id_supported_by: statement.id };

    void scanContent(statTitle.trim(), 'statement_title', statement.id, resolutionId, createdBy);
    if (statDescription?.trim()) {
      void scanContent(statDescription.trim(), 'statement_description', statement.id, resolutionId, createdBy);
    }

    return { ok: true, data: { statement, relationship } };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create statement failed:', err);
    return { ok: false, status: 500, error: 'Database error' };
  } finally {
    client.release();
  }
}

export async function getStatementForOwnershipCheck(id: string) {
  const { rows: [stmt] } = await pool.query(
    'SELECT id, stat_title, stat_description, created_by, resolution_id, stat_type FROM statements WHERE id = $1',
    [id],
  );
  return stmt ?? null;
}

export async function updateStatementText(id: string, title: string, description: string | null, resolutionId: string, editedBy: string): Promise<ApiResult<{ ok: true }>> {
  const newTitle = title.trim();
  if (!newTitle) return { ok: false, status: 400, error: 'Title is required' };

  const { rows: [stmt] } = await pool.query('SELECT stat_title FROM statements WHERE id = $1', [id]);
  if (!stmt) return { ok: false, status: 404, error: 'Not found' };

  if (newTitle !== stmt.stat_title) {
    const { rows: children } = await pool.query(
      'SELECT 1 FROM stat_relationships WHERE stat_id_supported = $1 LIMIT 1',
      [id],
    );
    if (children.length > 0) {
      return { ok: false, status: 422, error: 'Cannot change the statement text — it has connected responses that depend on it.' };
    }
  }

  await pool.query(
    'UPDATE statements SET stat_title = $2, stat_description = $3 WHERE id = $1',
    [id, newTitle, description?.trim() || null],
  );

  void scanContent(newTitle, 'statement_title', id, resolutionId, editedBy);
  if (description?.trim()) void scanContent(description.trim(), 'statement_description', id, resolutionId, editedBy);

  return { ok: true, data: { ok: true } };
}

export async function retractStatementCascade(id: string): Promise<string[]> {
  const { rows } = await pool.query(
    `WITH RECURSIVE deps AS (
       SELECT $1::uuid AS id
       UNION
       SELECT sr.stat_id_supported_by
       FROM   stat_relationships sr
       JOIN   deps d ON sr.stat_id_supported = d.id
     )
     UPDATE statements
     SET    retracted_at = NOW()
     WHERE  id IN (SELECT id FROM deps) AND retracted_at IS NULL
     RETURNING id`,
    [id],
  );
  return rows.map((r: { id: string }) => r.id);
}
