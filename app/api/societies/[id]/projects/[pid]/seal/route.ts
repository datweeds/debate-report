import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { projectContext, text } from '@/lib/projects';
import { sealText } from '@/lib/societyCrypto';
import { RICH_MAX } from '@/lib/tasks';
import { lockSafe } from '@/lib/lockSafe';
import { allowsSealed, firstLocks, readLocks } from '@/lib/sealed/server';

type Params = { params: Promise<{ id: string; pid: string }> };
type T = { id: string; name?: unknown; description?: unknown; comments?: unknown; body?: unknown };

// POST — the Project Manager or a moderator seals or unseals the project. The
// browser does the encrypting (or decrypting) and sends every piece of text back:
//   { action: 'seal' | 'unseal', locks? (seal), project: { name, description },
//     tasks: [{ id, name, description, comments }], reports: [{ id, body }],
//     raid: [{ id, name, description }], groups: [{ id, name }] }
// Sealed text is for epoch 1 of this project; unsealed text is plain.
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, pid } = await params;
  const c = await projectContext(req, id, pid);
  if (!c?.me) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.canManage || !c.a.isMember) return NextResponse.json({ error: 'Only the Project Manager or a Society Admin can do this' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const list = (v: unknown): T[] => (Array.isArray(v) ? v : []);
  const tasks = list(b.tasks), reports = list(b.reports), raid = list(b.raid), groups = list(b.groups);

  // Everything must be included, so nothing is left behind
  const [{ rows: ct }, { rows: cr }, { rows: cx }, { rows: cg }] = await Promise.all([
    pool.query('SELECT id FROM project_tasks WHERE project_id = $1', [pid]),
    pool.query('SELECT r.id FROM project_status_reports r JOIN project_tasks t ON t.id = r.task_id WHERE t.project_id = $1', [pid]),
    pool.query('SELECT id FROM project_raid WHERE project_id = $1', [pid]),
    pool.query('SELECT id FROM project_task_groups WHERE project_id = $1', [pid]),
  ]);
  const same = (cur: { id: string }[], given: T[]) => cur.length === given.length && cur.every(r => given.some(g => g.id === r.id));
  if (!same(ct, tasks) || !same(cr, reports) || !same(cx, raid) || !same(cg, groups)) {
    return NextResponse.json({ error: 'The project changed while this was happening: try again' }, { status: 409 });
  }

  const sealing = b.action === 'seal';
  if (!sealing && b.action !== 'unseal') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  if (sealing === !!c.sealed) return NextResponse.json({ error: sealing ? 'It’s already sealed' : 'It isn’t sealed' }, { status: 409 });
  const isE2E = (v: unknown) => typeof v === 'string' && v.length <= 140000 && /^sn1:1:[A-Za-z0-9+/]+={0,2}$/.test(v);
  // Sealing: sealed text stored as it is. Unsealing: plain text, stored by the Society's usual rule.
  const put = async (v: unknown, max: number, required = false): Promise<string | null | false> => {
    if (v == null || v === '') return required ? false : null;
    if (sealing) return isE2E(v) ? v as string : false;
    if (typeof v !== 'string' || v.startsWith('sn1:')) return false;
    const t = text(v, max);
    return t == null ? (required ? false : null) : sealText(c.a.societyId, t);
  };

  const client = await pool.connect();
  const fail = async (msg: string) => { await client.query('ROLLBACK'); return NextResponse.json({ error: msg }, { status: 400 }); };
  try {
    await client.query('BEGIN');
    if (sealing) {
      if (!await allowsSealed(c.a.societyId)) return fail('This Society doesn’t allow Sealed items');
      const locks = readLocks(b.locks);
      if (!locks) return fail('That wasn’t understood');
      await client.query(`UPDATE projects SET protection = 'sealed', sealed_epoch = 1 WHERE id = $1`, [pid]);
      const problem = await firstLocks(client, { type: 'project', id: pid, societyId: c.a.societyId, epoch: 1 }, c.me, locks);
      if (problem) return fail(problem);
    }
    const name = await put(b.project?.name, 200, true), desc = await put(b.project?.description, 5000);
    if (name === false || desc === false) return fail('The project’s name and description couldn’t be stored');
    await client.query('UPDATE projects SET name = $1, description = $2, updated_at = now() WHERE id = $3', [name, desc, pid]);
    for (const t of tasks) {
      const n = await put(t.name, 200, true), d = await put(t.description, RICH_MAX), cm = await put(t.comments, 5000);
      if (n === false || d === false || cm === false) return fail('A task couldn’t be stored');
      await client.query('UPDATE project_tasks SET name = $1, description = $2, comments = $3 WHERE id = $4', [n, d, cm, t.id]);
    }
    for (const r of reports) {
      const v = await put(r.body, 5000, true);
      if (v === false) return fail('A status report couldn’t be stored');
      await client.query('UPDATE project_status_reports SET body = $1 WHERE id = $2', [v, r.id]);
    }
    for (const r of raid) {
      const n = await put(r.name, 200, true), d = await put(r.description, 5000);
      if (n === false || d === false) return fail('A RAID item couldn’t be stored');
      await client.query('UPDATE project_raid SET name = $1, description = $2 WHERE id = $3', [n, d, r.id]);
    }
    for (const g of groups) {
      const n = await put(g.name, 120, true);
      if (n === false) return fail('A Task Group couldn’t be stored');
      await client.query('UPDATE project_task_groups SET name = $1 WHERE id = $2', [n, g.id]);
    }
    if (!sealing) {
      await client.query(`UPDATE projects SET protection = 'server', sealed_epoch = NULL WHERE id = $1`, [pid]);
      await client.query(`DELETE FROM sealed_item_keys WHERE item_type = 'project' AND item_id = $1`, [pid]);
    }
    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
}

export const POST = lockSafe(handlePOST);
