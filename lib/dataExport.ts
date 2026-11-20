// Data exports: everything in a Society (for its Society Admins, e.g. at the
// end of service) and everything a member has put into the site (their own
// copy of their personal data). Each is one ZIP of JSON files plus uploaded
// files, decrypted where the server holds the key. Server-only.
//
// Tables are found from the database itself (tenant columns and foreign keys),
// so tables added later are exported without changes here.

import { readFile, mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import type { PoolClient } from 'pg';
import pool from './db';
import { storedPath, isBrowserSealed } from './documents';
import { isEndToEnd, isSealed, openText, openFile, fileIsSealed } from './societyCrypto';
import { ZipWriter } from './zip';

const E2E_NOTE = '[Sealed in members’ browsers: the server can’t read this. Open it in new.vote to read it.]';

// Never exported: keys, secrets, sessions, and per-person bookkeeping
const NEVER = new Set([
  'society_keys', 'sealed_item_keys', 'user_sealed_keys', 'user_sealed_passkeys', 'passkeys', 'sso_tokens',
  'push_subscriptions', 'push_prefs', 'access_keys', 'access_key_debates', 'master_key_state', 'master_key_log',
  'sysadmin_access', 'society_section_seen', 'discussion_thread_seen', 'users',
]);
// Members' personal tools: private to each member, so not in a Society export
const PERSONAL = new Set(['task_categories', 'task_category_links']);

type Row = Record<string, unknown>;
type Fk = { child: string; col: string; parent: string; pcol: string };

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

async function schema(client: PoolClient) {
  const { rows: fks } = await client.query<Fk>(
    `SELECT c.conrelid::regclass::text AS child, a.attname AS col, c.confrelid::regclass::text AS parent, af.attname AS pcol
     FROM pg_constraint c
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = c.confkey[1]
     WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1`);
  const { rows: cols } = await client.query<{ t: string; c: string }>(
    `SELECT c.table_name AS t, c.column_name AS c FROM information_schema.columns c
     JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema AND t.table_type = 'BASE TABLE'
     WHERE c.table_schema = 'public'`);
  const columns = new Map<string, Set<string>>();
  for (const r of cols) (columns.get(r.t) ?? columns.set(r.t, new Set()).get(r.t)!).add(r.c);
  return { fks: fks.map(f => ({ ...f, child: f.child.replace(/"/g, ''), parent: f.parent.replace(/"/g, '') })), columns };
}

// Decrypt what the server can open; mark what only members' browsers can;
// bytes as base64 so the JSON stays readable.
async function clean(v: unknown, cid: number | null): Promise<unknown> {
  if (isEndToEnd(v)) return E2E_NOTE;
  if (isSealed(v)) return openText(cid, v);
  if (Buffer.isBuffer(v)) return { base64: v.toString('base64') };
  if (Array.isArray(v)) return Promise.all(v.map(x => clean(x, cid)));
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const o: Row = {};
    for (const [k, x] of Object.entries(v)) o[k] = await clean(x, cid);
    return o;
  }
  return v;
}
const rowSociety = (r: Row, fallback: number | null) =>
  (typeof r.customer_id === 'number' ? r.customer_id : typeof r.tenant_id === 'number' ? r.tenant_id : fallback);

async function cleanRows(rows: Row[], cid: number | null) {
  const out: Row[] = [];
  for (const r of rows) out.push(await clean(r, rowSociety(r, cid)) as Row);
  return out;
}

async function readTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    // Some ScotParl tables have row-level security: see every row for this read
    await client.query("SELECT set_config('app.tenant_id', 'admin', true)");
    return await fn(client);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}

const json = (v: unknown) => JSON.stringify(v, null, 2);
const safeName = (s: string) => s.replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').slice(0, 120) || 'file';
const stamp = () => new Date().toISOString().slice(0, 10);

/** Write a ZIP to a temporary folder; the caller streams it and calls cleanup(). */
async function build(fill: (zip: ZipWriter) => Promise<void>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'nv-export-'));
  const file = path.join(dir, 'export.zip');
  const zip = await ZipWriter.create(file);
  try { await fill(zip); await zip.close(); }
  catch (e) { await zip.abort(); await rm(dir, { recursive: true, force: true }); throw e; }
  return { file, cleanup: () => rm(dir, { recursive: true, force: true }).catch(() => {}) };
}

// A stored document's bytes as the member saw them, or why they can't be included
async function documentFile(cid: number, storedName: string): Promise<Buffer | string> {
  if (path.basename(storedName) !== storedName) return 'unsafe file name';
  const data: Buffer | null = await readFile(storedPath(cid, storedName)).catch(() => null);
  if (!data) return 'file missing on the server';
  if (isBrowserSealed(data)) return 'sealed in members’ browsers: the server can’t read it';
  return fileIsSealed(data) ? openFile(cid, data) : data;
}

async function addDocuments(zip: ZipWriter, docs: Row[], skipped: string[]) {
  for (const d of docs) {
    if (!d.stored_name || d.deleted_at) continue;
    const cid = d.customer_id as number;
    const data = await documentFile(cid, String(d.stored_name)).catch(() => 'couldn’t be read');
    const label = await openText(cid, (d.file_name ?? d.title ?? null) as string | null);
    const name = `${d.id}-${safeName(String(isEndToEnd(label) || !label ? 'file' : label))}`;
    if (typeof data === 'string') skipped.push(`${name}: ${data}`);
    else await zip.add(`files/documents/${name}`, data);
  }
}

async function addPublicFile(zip: ZipWriter, webPath: unknown, folder: string) {
  if (typeof webPath !== 'string' || !webPath.startsWith(`/uploads/${folder}/`)) return;
  const name = path.basename(webPath);
  const data = await readFile(path.join(process.cwd(), 'public', 'uploads', folder, name)).catch(() => null);
  if (data) await zip.add(`files/${folder}/${name}`, data);
}

// People mentioned by id in the exported rows: id → handle, so the files make sense
async function people(client: PoolClient, tables: Map<string, Row[]>) {
  const ids = new Set<string>();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const rows of tables.values()) for (const r of rows) {
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'string' && uuid.test(v) && /(^user_id$|_by$|^owner_id$|^author_id$|^manager_id$|^actor$|^target$)/.test(k)) ids.add(v);
    }
  }
  if (!ids.size) return [];
  const { rows } = await client.query(
    `SELECT id, user_handle AS handle, CASE WHEN user_status = 'closed' THEN NULL ELSE user_full_name END AS name
     FROM users WHERE id = ANY($1::uuid[]) ORDER BY user_handle`, [[...ids]]);
  return rows;
}

// ── Society export ───────────────────────────────────────────────────────────

const README_SOCIETY = (name: string) => `new.vote — data export for the Society “${name}”
Exported ${new Date().toISOString()}

society.json      the Society's settings
members.json      members and Society Admins (handles and names; emails aren't shared with Society Admins)
people.json       everyone mentioned by id in the tables (id → handle)
tables/*.json     every record in the Society, one file per database table
files/            uploaded documents, the Society's image and debate images
skipped.txt       anything that couldn't be included, and why (if present)

Text is decrypted where the server holds the Society's key. Content sealed in
members' browsers (end-to-end) can't be read by the server and is marked as such.
Members' private personal tasks and categories are not included: only tasks
they shared are.
`;

export async function exportSociety(societyId: number) {
  return readTx(async client => {
    const { rows: [soc] } = await client.query('SELECT * FROM customers WHERE id = $1', [societyId]);
    if (!soc) throw new Error('Not found');
    const { fks, columns } = await schema(client);
    const tenantCol = (t: string) => ['customer_id', 'tenant_id'].filter(c => columns.get(t)?.has(c));

    // Grow the set of records until it stops changing: rows with the Society's
    // id, then rows pointing at those rows, and so on.
    const tables = new Map<string, Row[]>([['customers', [soc]]]);
    for (let pass = 0; pass < 10; pass++) {
      let changed = false;
      for (const t of columns.keys()) {
        if (NEVER.has(t) || PERSONAL.has(t) || t === 'customers') continue;
        const tc = tenantCol(t);
        const params: unknown[] = [];
        const links: string[] = [];
        for (const f of fks) {
          if (f.child !== t || f.parent === 'users') continue;
          const parentRows = tables.get(f.parent);
          if (!parentRows?.length) continue;
          const vals = [...new Set(parentRows.map(r => r[f.pcol]).filter(v => v != null).map(String))];
          if (!vals.length) continue;
          params.push(vals);
          links.push(`${q(f.col)}::text = ANY($${params.length}::text[])`);
        }
        const own = tc.map(c => { params.push(societyId); return `${q(c)} = $${params.length}`; });
        if (!own.length && !links.length) continue;
        // A row carrying another Society's id never comes along through a link
        const linked = links.length ? `((${links.join(' OR ')})${tc.map(c => ` AND ${q(c)} IS NULL`).join('')})` : null;
        const where = [...own, ...(linked ? [linked] : [])].join(' OR ');
        let { rows } = await client.query(`SELECT * FROM ${q(t)} WHERE ${where}`, params);
        if (t === 'society_tasks') {
          // Only tasks their owners shared; private ones stay private
          const shared = new Set((await client.query('SELECT DISTINCT task_id::text AS id FROM task_shares')).rows.map(r => r.id));
          rows = rows.filter(r => r.shared_all || shared.has(String(r.id)));
        }
        if (rows.length !== (tables.get(t)?.length ?? 0)) { tables.set(t, rows); changed = true; }
      }
      if (!changed) break;
    }

    const { rows: members } = await client.query(
      `SELECT u.id, u.user_handle AS handle, u.user_full_name AS name, m.joined_at,
              EXISTS (SELECT 1 FROM customer_roles r WHERE r.tenant_id = $1 AND r.user_id = u.id::text AND r.role = 'customer_admin') AS society_admin
       FROM users u JOIN customer_members m ON m.user_id = u.id::text AND m.customer_id = $1
       UNION
       SELECT u.id, u.user_handle, u.user_full_name, r.created_at, true
       FROM users u JOIN customer_roles r ON r.user_id = u.id::text AND r.tenant_id = $1 AND r.role = 'customer_admin'
       WHERE NOT EXISTS (SELECT 1 FROM customer_members m WHERE m.customer_id = $1 AND m.user_id = u.id::text)
       ORDER BY 2`, [societyId]);
    const who = await people(client, tables);

    return build(async zip => {
      const skipped: string[] = [];
      await zip.add('README.txt', README_SOCIETY(soc.name));
      await zip.add('society.json', json(await clean(soc, societyId)));
      await zip.add('members.json', json(members));
      await zip.add('people.json', json(who));
      for (const [t, rows] of [...tables].sort(([a], [b]) => a.localeCompare(b))) {
        if (rows.length && t !== 'customers') await zip.add(`tables/${t}.json`, json(await cleanRows(rows, societyId)));
      }
      await addDocuments(zip, tables.get('documents') ?? [], skipped);
      await addPublicFile(zip, soc.hero_image, 'societies');
      for (const s of tables.get('statements') ?? []) await addPublicFile(zip, s.image_path, 'debates');
      if (skipped.length) await zip.add('skipped.txt', skipped.join('\n') + '\n');
    }).then(r => ({ ...r, filename: `new.vote-society-${safeName(String(soc.subdomain ?? soc.id))}-${stamp()}.zip` }));
  });
}

// ── Personal export ──────────────────────────────────────────────────────────

// Columns that mean "this person made it, or it's theirs"
const MINE = new Set(['created_by', 'user_id', 'owner_id', 'uploaded_by', 'sent_by', 'manager_id', 'flagged_by', 'reported_by']);
// Text-typed user ids with no foreign key to users
const UNLINKED: [string, string][] = [
  ['debate_join_requests', 'user_id'], ['debate_members', 'user_id'], ['nsp_principle_favs', 'user_id'],
  ['nsp_review_requests', 'user_id'], ['proposal_favs', 'user_id'], ['sp_bill_favs', 'user_id'], ['topic_owners', 'user_id'],
  ['society_join_requests', 'user_id'], ['society_interest_flags', 'flagged_by'], ['society_invites', 'created_by'],
  ['nsp_principle_sets', 'created_by'], ['nsp_principle_debates', 'created_by'], ['nsp_topics', 'created_by'],
];
// Account fields that are secrets or internal, not personal data
const ACCOUNT_OMIT = ['password_hash', 'access_code', 'user_job', 'user_job_created', 'user_job_status', 'stripe_customer_id', 'stripe_sub_id', 'stripe_price_id'];

const README_ME = (handle: string) => `new.vote — your data (@${handle})
Exported ${new Date().toISOString()}

account.json      your account and profile
memberships.json  the Societies you belong to, and where you're a Society Admin
people.json       everyone mentioned by id in the tables (id → handle)
tables/*.json     everything you've made or done on the site, one file per database table
                  (arguments, votes, posts, documents, events, polls, tasks, requests…)
files/            documents you uploaded
skipped.txt       anything that couldn't be included, and why (if present)

Text is decrypted where the server holds the key. Content sealed in members'
browsers (end-to-end) can't be read by the server and is marked as such.
`;

export async function exportUser(userId: string) {
  return readTx(async client => {
    const { rows: [me] } = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!me) throw new Error('Not found');
    for (const k of ACCOUNT_OMIT) delete me[k];
    const { fks, columns } = await schema(client);

    const tables = new Map<string, Row[]>();
    const add = (t: string, rows: Row[]) => {
      const have = tables.get(t) ?? [];
      const seen = new Set(have.map(r => JSON.stringify(r)));
      tables.set(t, [...have, ...rows.filter(r => !seen.has(JSON.stringify(r)))]);
    };
    for (const f of fks) {
      if (f.parent !== 'users' || !MINE.has(f.col) || NEVER.has(f.child)) continue;
      add(f.child, (await client.query(`SELECT * FROM ${q(f.child)} WHERE ${q(f.col)} = $1`, [userId])).rows);
    }
    for (const [t, c] of UNLINKED) {
      if (!columns.get(t)?.has(c)) continue;
      add(t, (await client.query(`SELECT * FROM ${q(t)} WHERE ${q(c)} = $1`, [userId])).rows);
    }
    if (me.email) {
      for (const [t, c] of [['debate_invitations', 'invitee_email'], ['blog_subscribers', 'email'], ['contact_messages', 'email'], ['website_messages', 'sender_email']]) {
        if (columns.get(t)?.has(c)) add(t, (await client.query(`SELECT * FROM ${q(t)} WHERE lower(${q(c)}) = lower($1)`, [me.email])).rows);
      }
    }
    for (const [t, rows] of tables) if (!rows.length) tables.delete(t);

    const { rows: memberships } = await client.query(
      `SELECT c.id, c.name, c.subdomain, m.joined_at,
              EXISTS (SELECT 1 FROM customer_roles r WHERE r.tenant_id = c.id AND r.user_id = $1 AND r.role = 'customer_admin') AS society_admin
       FROM customers c JOIN customer_members m ON m.customer_id = c.id AND m.user_id = $1
       UNION
       SELECT c.id, c.name, c.subdomain, r.created_at, true FROM customers c JOIN customer_roles r ON r.tenant_id = c.id AND r.user_id = $1 AND r.role = 'customer_admin'
       WHERE NOT EXISTS (SELECT 1 FROM customer_members m WHERE m.customer_id = c.id AND m.user_id = $1)
       ORDER BY 2`, [userId]);
    const who = await people(client, tables);

    return build(async zip => {
      const skipped: string[] = [];
      await zip.add('README.txt', README_ME(me.user_handle));
      await zip.add('account.json', json(me));
      await zip.add('memberships.json', json(memberships));
      await zip.add('people.json', json(who));
      for (const [t, rows] of [...tables].sort(([a], [b]) => a.localeCompare(b))) {
        await zip.add(`tables/${t}.json`, json(await cleanRows(rows, null)));
      }
      await addDocuments(zip, tables.get('documents') ?? [], skipped);
      for (const s of tables.get('statements') ?? []) await addPublicFile(zip, s.image_path, 'debates');
      if (skipped.length) await zip.add('skipped.txt', skipped.join('\n') + '\n');
    }).then(r => ({ ...r, filename: `new.vote-my-data-${safeName(me.user_handle)}-${stamp()}.zip` }));
  });
}

