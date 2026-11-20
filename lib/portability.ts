// Moving and copying debates and documents between Societies a moderator runs.
// Everything happens inside the caller's transaction. Server-only.

import crypto from 'crypto';
import { copyFile, rename, mkdir, unlink } from 'fs/promises';
import path from 'path';
import type { PoolClient } from 'pg';
import { storedPath } from './documents';
import { recryptDocument, recryptRow } from './societyRekey';
import { reencryptDebate } from './debateCrypto';

export type DebateOptions = { includeVotes: boolean; includeChat: boolean };

// Columns of a table except the ones the caller sets itself, read from the
// database so columns added later are carried over automatically.
async function columns(client: PoolClient, table: string, except: string[]): Promise<string[]> {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table],
  );
  return rows.map(r => r.column_name as string).filter(c => !except.includes(c));
}
const q = (c: string) => `"${c}"`;

// Vote tallies cached on statements; cleared when votes aren't carried over.
const VOTE_CACHE = ['vote_for', 'vote_against', 'vote_total_for', 'vote_total_against', 'metric_weight', 'metric_weight_for', 'metric_weight_against'];

// ── Debates ──────────────────────────────────────────────────────────────────

/** Copy a whole debate into another Society. Returns the new resolution id. */
export async function copyDebate(client: PoolClient, resolutionId: string, targetSocietyId: number, opts: DebateOptions): Promise<string> {
  const { rows: stmts } = await client.query(
    `SELECT id, stat_type FROM statements WHERE id = $1 OR resolution_id = $1`, [resolutionId],
  );
  const map = new Map<string, string>(stmts.map(s => [s.id as string, crypto.randomUUID()]));
  const newRes = map.get(resolutionId)!;

  await client.query('CREATE TEMP TABLE IF NOT EXISTS _idmap (old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP');
  await client.query('TRUNCATE _idmap');
  await client.query(
    'INSERT INTO _idmap (old_id, new_id) SELECT * FROM unnest($1::uuid[], $2::uuid[])',
    [[...map.keys()], [...map.values()]],
  );

  // Statements: same content and references, new ids, in the target Society
  const cols = await columns(client, 'statements', ['id', 'resolution_id', 'customer_id', 'science_analysis_id', 'updated_at']);
  await client.query(
    `INSERT INTO statements (id, resolution_id, customer_id, updated_at, ${cols.map(q).join(', ')})
     SELECT m.id_new, CASE WHEN s.resolution_id IS NULL THEN NULL ELSE $1::uuid END,
            CASE WHEN s.stat_type = 'resolution' OR s.customer_id IS NOT NULL THEN $2::int END, now(),
            ${cols.map(c => `s.${q(c)}`).join(', ')}
     FROM statements s JOIN (SELECT old_id, new_id AS id_new FROM _idmap) m ON m.old_id = s.id
     -- the resolution first, so children can point at it
     ORDER BY (s.resolution_id IS NOT NULL)`,
    [newRes, targetSocietyId],
  );
  if (!opts.includeVotes) {
    await client.query(
      `UPDATE statements SET ${VOTE_CACHE.map(c => `${c} = 0`).join(', ')} WHERE id IN (SELECT new_id FROM _idmap)`,
    );
  }

  // How the statements connect
  await client.query(
    `INSERT INTO stat_relationships (stat_id_supported, stat_id_supported_by, created_by, created_at)
     SELECT a.new_id, b.new_id, r.created_by, r.created_at
     FROM stat_relationships r JOIN _idmap a ON a.old_id = r.stat_id_supported JOIN _idmap b ON b.old_id = r.stat_id_supported_by`,
  );

  // Fallacy tags
  await client.query(
    `INSERT INTO statement_fallacies (statement_id, fallacy_id, fallacy_comment, created_by, created_at)
     SELECT m.new_id, f.fallacy_id, f.fallacy_comment, f.created_by, f.created_at
     FROM statement_fallacies f JOIN _idmap m ON m.old_id = f.statement_id`,
  );

  // Science analyses (and their references), re-pointed at the copies
  const { rows: analyses } = await client.query(
    `SELECT a.id, m.new_id AS statement_id FROM science_analyses a JOIN _idmap m ON m.old_id = a.statement_id`,
  );
  if (analyses.length) {
    const aCols = await columns(client, 'science_analyses', ['id', 'statement_id']);
    const rCols = await columns(client, 'science_analysis_refs', ['id', 'analysis_id']);
    for (const a of analyses) {
      const { rows: [na] } = await client.query(
        `INSERT INTO science_analyses (statement_id, ${aCols.map(q).join(', ')})
         SELECT $2, ${aCols.map(q).join(', ')} FROM science_analyses WHERE id = $1 RETURNING id`,
        [a.id, a.statement_id],
      );
      if (rCols.length) {
        await client.query(
          `INSERT INTO science_analysis_refs (analysis_id, ${rCols.map(q).join(', ')})
           SELECT $2, ${rCols.map(q).join(', ')} FROM science_analysis_refs WHERE analysis_id = $1`,
          [a.id, na.id],
        );
      }
      await client.query('UPDATE statements SET science_analysis_id = $1 WHERE id = $2', [na.id, a.statement_id]);
    }
  }

  if (opts.includeVotes) {
    await client.query(
      `INSERT INTO stat_votes (statement_id, created_by, created_at, updated_at, vote, vote_debate_impact, vote_rationale)
       SELECT m.new_id, v.created_by, v.created_at, v.updated_at, v.vote, v.vote_debate_impact, v.vote_rationale
       FROM stat_votes v JOIN _idmap m ON m.old_id = v.statement_id`,
    );
  }

  if (opts.includeChat) {
    // Messages keep their reply threading, so map comment ids too
    const { rows: comments } = await client.query(
      `SELECT c.id FROM comments c JOIN _idmap m ON m.old_id = c.statement_id`,
    );
    if (comments.length) {
      const cmap = comments.map(c => [c.id as string, crypto.randomUUID()]);
      await client.query('CREATE TEMP TABLE IF NOT EXISTS _cmap (old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP');
      await client.query('TRUNCATE _cmap');
      await client.query('INSERT INTO _cmap SELECT * FROM unnest($1::uuid[], $2::uuid[])', [cmap.map(c => c[0]), cmap.map(c => c[1])]);
      await client.query(
        `INSERT INTO comments (id, statement_id, parent_id, created_by, created_at, updated_at, comment_title, comment_body,
                               comment_status, moderator_id, moderator_review, is_deleted)
         SELECT cm.new_id, m.new_id, pm.new_id, c.created_by, c.created_at, c.updated_at, c.comment_title, c.comment_body,
                c.comment_status, c.moderator_id, c.moderator_review, c.is_deleted
         FROM comments c
         JOIN _cmap cm ON cm.old_id = c.id
         JOIN _idmap m ON m.old_id = c.statement_id
         LEFT JOIN _cmap pm ON pm.old_id = c.parent_id
         ORDER BY c.created_at`,
      );
      await client.query(
        `INSERT INTO comment_reactions (comment_id, user_id, emoji, created_at)
         SELECT cm.new_id, r.user_id, r.emoji, r.created_at FROM comment_reactions r JOIN _cmap cm ON cm.old_id = r.comment_id`,
      );
    }
  }
  await reencryptDebate(newRes, client);  // the copy is encrypted (or not) as its new Society requires
  return newRes;
}

/** Move a debate to another Society, optionally discarding its votes and chat. */
export async function moveDebate(client: PoolClient, resolutionId: string, targetSocietyId: number, opts: DebateOptions) {
  await client.query(
    `UPDATE statements SET customer_id = $2
     WHERE id = $1 OR (resolution_id = $1 AND customer_id IS NOT NULL)`,
    [resolutionId, targetSocietyId],
  );
  const inDebate = `SELECT id FROM statements WHERE id = $1 OR resolution_id = $1`;
  if (!opts.includeVotes) {
    await client.query(`DELETE FROM stat_votes WHERE statement_id IN (${inDebate})`, [resolutionId]);
    await client.query(`UPDATE statements SET ${VOTE_CACHE.map(c => `${c} = 0`).join(', ')} WHERE id IN (${inDebate})`, [resolutionId]);
  }
  if (!opts.includeChat) {
    await client.query(`DELETE FROM comments WHERE statement_id IN (${inDebate})`, [resolutionId]);
  }
  // A debate on one Society's principle doesn't belong to the new Society's principles
  await client.query('UPDATE society_principle_links SET resolution_id = NULL WHERE resolution_id = $1', [resolutionId]);
  await reencryptDebate(resolutionId, client);
}

// ── Documents ────────────────────────────────────────────────────────────────

type DocRow = { id: string; customer_id: number; kind: string; stored_name: string | null };

async function transferDoc(client: PoolClient, doc: DocRow, target: number, folderId: string | null, mode: 'move' | 'copy') {
  if (mode === 'move') {
    // Update the row first: if moving the file then fails, the transaction rolls back
    await client.query('UPDATE documents SET customer_id = $1, folder_id = $2, updated_at = now() WHERE id = $3', [target, folderId, doc.id]);
    if (doc.kind === 'file' && doc.stored_name && doc.customer_id !== target) {
      await mkdir(path.dirname(storedPath(target, doc.stored_name)), { recursive: true });
      await rename(storedPath(doc.customer_id, doc.stored_name), storedPath(target, doc.stored_name));
    }
    // Re-encrypt for the target Society (its key; or plain if it is public)
    if (doc.customer_id !== target) {
      await recryptDocument(client, doc.id, doc.customer_id, target);
      // Share links belong to the Society that made them: they stop (private links' copies are deleted)
      const { rows: gone } = await client.query(
        'UPDATE document_shares SET revoked_at = now() WHERE document_id = $1 AND revoked_at IS NULL RETURNING customer_id, stored_name', [doc.id]);
      for (const g of gone) if (g.stored_name) await unlink(storedPath(g.customer_id, g.stored_name)).catch(() => {});
    }
    return;
  }
  // Copy: a fresh file and row; open/download counts start again
  let storedName: string | null = null;
  if (doc.kind === 'file' && doc.stored_name) {
    storedName = `${crypto.randomUUID()}${path.extname(doc.stored_name)}`;
    await mkdir(path.dirname(storedPath(target, storedName)), { recursive: true });
    await copyFile(storedPath(doc.customer_id, doc.stored_name), storedPath(target, storedName));
  }
  const { rows: [copy] } = await client.query(
    `INSERT INTO documents (customer_id, folder_id, kind, title, description, url, file_name, stored_name, mime_type, size_bytes, uploaded_by, created_at)
     SELECT $2, $3, kind, title, description, url, file_name, $4, mime_type, size_bytes, uploaded_by, created_at
     FROM documents WHERE id = $1 RETURNING id`,
    [doc.id, target, folderId, storedName],
  );
  await recryptDocument(client, copy.id, doc.customer_id, target);
}

/** Move or copy a document into a folder (or the top level) of another Society. */
export async function transferDocument(client: PoolClient, docId: string, target: number, folderId: string | null, mode: 'move' | 'copy') {
  const { rows: [doc] } = await client.query(
    'SELECT id, customer_id, kind, stored_name FROM documents WHERE id = $1 AND deleted_at IS NULL', [docId],
  );
  if (doc) await transferDoc(client, doc, target, folderId, mode);
}

/** Move or copy a folder with everything in it (sub-folders included). */
export async function transferFolder(client: PoolClient, folderId: string, target: number, parentId: string | null, mode: 'move' | 'copy') {
  const { rows: [f] } = await client.query('SELECT id, customer_id, name FROM document_folders WHERE id = $1', [folderId]);
  if (!f) return;
  if (mode === 'move') {
    // Re-home the folder; its documents follow (sub-folders recurse)
    await client.query('UPDATE document_folders SET customer_id = $1, parent_id = $2 WHERE id = $3', [target, parentId, folderId]);
    await recryptRow(client, 'document_folders', folderId, ['name'], f.customer_id, target);
    const { rows: docs } = await client.query('SELECT id, customer_id, kind, stored_name FROM documents WHERE folder_id = $1 AND deleted_at IS NULL', [folderId]);
    for (const d of docs) await transferDoc(client, d, target, folderId, 'move');
    const { rows: subs } = await client.query('SELECT id FROM document_folders WHERE parent_id = $1', [folderId]);
    for (const s of subs) await transferFolder(client, s.id, target, folderId, 'move');
    return;
  }
  const { rows: [nf] } = await client.query(
    'INSERT INTO document_folders (customer_id, parent_id, name, created_by) SELECT $2, $3, name, created_by FROM document_folders WHERE id = $1 RETURNING id',
    [folderId, target, parentId],
  );
  await recryptRow(client, 'document_folders', nf.id, ['name'], f.customer_id, target);
  const { rows: docs } = await client.query('SELECT id, customer_id, kind, stored_name FROM documents WHERE folder_id = $1 AND deleted_at IS NULL', [folderId]);
  for (const d of docs) await transferDoc(client, d, target, nf.id, 'copy');
  const { rows: subs } = await client.query('SELECT id FROM document_folders WHERE parent_id = $1', [folderId]);
  for (const s of subs) await transferFolder(client, s.id, target, nf.id, 'copy');
}
