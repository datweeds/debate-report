// Closing, reopening and permanently deleting a Society. Server-only.
//
// Closed: the Society drops out of every menu and list, and only its
// moderators can open it (to reopen it from Manage Societies). Nothing is lost.
// Deleted: everything is erased — debates, discussions, documents and their
// files, events, polls, projects, tasks, members, keys — and can't be undone.

import { rm, unlink } from 'fs/promises';
import path from 'path';
import pool from './db';
import { STORAGE_DIR } from './documents';
import { forgetSociety } from './societyCrypto';
import { cancelAllFor } from './billing';

// The second confirmation: typed exactly (spacing and case aside)
export const DELETE_SENTENCE = 'I CONFIRM TO DELETE THE SOCIETY UNDERSTANDING ALL CONTENT WILL BE ERASED FOR EVER';
export const sentenceMatches = (v: unknown) =>
  typeof v === 'string' && v.trim().replace(/\s+/g, ' ').toUpperCase() === DELETE_SENTENCE;

// The site's default and demo Societies can't be closed or deleted
export async function protectedReason(id: number): Promise<string | null> {
  const { rows: [c] } = await pool.query('SELECT is_default, is_demo FROM customers WHERE id = $1', [id]);
  if (!c) return 'Not found';
  if (c.is_default) return 'This is the site’s default Society, so it can’t be closed or deleted.';
  if (c.is_demo) return 'This is the demo Society. Ask a Sys Admin to choose another demo first.';
  return null;
}

/** Why the Society can't be deleted yet because of reports (null if it can). */
export async function reportHold(id: number): Promise<string | null> {
  const { rows: [r] } = await pool.query(
    `SELECT 1 FROM content_alerts WHERE customer_id = $1 AND urgent AND status = 'pending' LIMIT 1`, [id]);
  return r ? 'This Society has a report of possibly illegal content waiting for the new.vote team to review, so it can’t be deleted yet. Contact us if this is urgent.' : null;
}

// Tables that point at a Society without cascading (a Society id, but no foreign key, or NO ACTION)
const TENANT_TABLES = [
  'sp_proposal_debates', 'sp_bill_debates', 'sp_bill_pvc_polls', 'sp_debate_requests', 'nsp_topics', 'proposals',
  'customer_roles', 'tenant_user_groups', 'ai_usage_log', 'society_impact_analyses', 'society_interest_flags', 'society_light_analyses',
];
// Tables that point at debate statements without cascading
const STATEMENT_REFS: [string, string][] = [
  ['debate_jobs', 'resolution_id'], ['sp_bill_debates', 'resolution_id'], ['sp_debate_request_actions', 'resolution_id'],
  ['sp_proposal_debates', 'resolution_id'], ['nsp_principle_debates', 'resolution_id'],
];

export async function deleteSociety(id: number, byUserId: string): Promise<{ name: string; debates: number }> {
  // Its plan stops first, so nothing is charged after the Society has gone
  await cancelAllFor({ kind: 'society', id });

  const client = await pool.connect();
  let hero: string | null = null, images: string[] = [], name = '', debates = 0;
  try {
    await client.query('BEGIN');
    // Some ScotParl tables have row-level security: see every Society's rows for this transaction
    await client.query("SELECT set_config('app.tenant_id', 'admin', true)");
    const { rows: [c] } = await client.query('SELECT name, hero_image FROM customers WHERE id = $1 FOR UPDATE', [id]);
    if (!c) throw new Error('Not found');
    name = c.name; hero = c.hero_image;

    // Debates: each resolution in this Society, and every statement under it
    const { rows: st } = await client.query(
      `SELECT id, image_path, stat_type::text AS type FROM statements
       WHERE customer_id = $1 OR resolution_id IN (SELECT id FROM statements WHERE customer_id = $1)`, [id]);
    const ids = st.map(r => r.id as string);
    images = st.map(r => r.image_path as string | null).filter((p): p is string => !!p);
    debates = st.filter(r => r.type === 'resolution').length;
    if (ids.length) {
      await client.query('UPDATE statements SET debate_job_id = NULL WHERE id = ANY($1::uuid[])', [ids]);
      for (const [t, col] of STATEMENT_REFS) await client.query(`DELETE FROM ${t} WHERE ${col} = ANY($1::uuid[])`, [ids]);
      await client.query('DELETE FROM statements WHERE id = ANY($1::uuid[]) AND resolution_id IS NOT NULL', [ids]);
      await client.query('DELETE FROM statements WHERE id = ANY($1::uuid[])', [ids]);
    }
    // Sealed items' keys (held per item, not per Society)
    await client.query(
      `DELETE FROM sealed_item_keys WHERE item_id IN (
         SELECT id FROM document_folders WHERE customer_id = $1 UNION SELECT id FROM discussion_threads WHERE customer_id = $1
         UNION SELECT id FROM projects WHERE customer_id = $1 UNION SELECT id FROM society_polls WHERE customer_id = $1
         UNION SELECT item_id FROM society_sealed_sections WHERE customer_id = $1)`, [id]);
    for (const t of TENANT_TABLES) await client.query(`DELETE FROM ${t} WHERE tenant_id = $1`, [id]);
    // Everything else cascades from the Society itself
    await client.query('DELETE FROM customers WHERE id = $1', [id]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  // Files on disk: documents and share copies, the header image, debate images
  forgetSociety(id);
  await rm(path.join(STORAGE_DIR, String(id)), { recursive: true, force: true }).catch(e => console.error('[society delete] files', e));
  if (hero?.startsWith('/uploads/societies/')) await unlink(path.join(process.cwd(), 'public', 'uploads', 'societies', path.basename(hero))).catch(() => {});
  for (const p of images) {
    if (p.startsWith('/uploads/debates/')) await unlink(path.join(process.cwd(), 'public', 'uploads', 'debates', path.basename(p))).catch(() => {});
  }
  console.log(`[society delete] Society ${id} “${name}” deleted by ${byUserId}: ${debates} debates`);
  return { name, debates };
}
