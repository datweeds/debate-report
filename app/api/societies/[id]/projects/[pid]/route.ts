import { NextRequest, NextResponse } from 'next/server';
import { allowsSealed } from '@/lib/sealed/server';
import pool from '@/lib/db';
import { openRows, sealText } from '@/lib/societyCrypto';
import { isSocietyMember, projectContext, PROJECT_STATUSES, readDate, text, UUID_RE, ptext } from '@/lib/projects';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; pid: string }> };

// GET — the whole project: tasks (flat, with parent links), who's allocated,
// each task's latest status report, the RAID log, and what the viewer may do.
export async function GET(req: NextRequest, { params }: Params) {
  const { id, pid } = await params;
  const c = await projectContext(req, id, pid);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [{ rows: tasks }, { rows: raid }, { rows: [mgr] }, { rows: groups }] = await Promise.all([
    pool.query(
      `SELECT t.id, t.parent_id, t.group_id, t.sort_order, t.name, t.description, t.status, t.comments,
              to_char(t.start_date, 'YYYY-MM-DD') AS start_date, to_char(t.end_date, 'YYYY-MM-DD') AS end_date,
              to_char(t.due_date, 'YYYY-MM-DD') AS due_date,
              COALESCE((SELECT json_agg(json_build_object('id', u.id, 'handle', u.user_handle, 'name', u.user_full_name) ORDER BY u.user_handle)
                        FROM project_task_assignees ta JOIN users u ON u.id = ta.user_id WHERE ta.task_id = t.id), '[]') AS assignees,
              (SELECT json_build_object('body', r.body, 'status', r.status, 'created_at', r.created_at, 'by', ru.user_handle)
               FROM project_status_reports r LEFT JOIN users ru ON ru.id = r.user_id
               WHERE r.task_id = t.id ORDER BY r.created_at DESC LIMIT 1) AS latest_report,
              (SELECT COUNT(*)::int FROM project_status_reports r WHERE r.task_id = t.id) AS report_count,
              COALESCE((SELECT json_agg(json_build_object('task_id', dp.depends_on, 'kind', dp.kind) ORDER BY dp.created_at)
                        FROM project_task_deps dp WHERE dp.task_id = t.id), '[]') AS dependencies,
              d.id AS document_id, d.kind AS doc_kind, d.title AS doc_title, d.file_name AS doc_file_name, d.mime_type AS doc_mime,
              d.protection AS doc_protection, d.folder_id AS doc_folder
       FROM project_tasks t
       LEFT JOIN documents d ON d.id = t.document_id AND d.deleted_at IS NULL
       WHERE t.project_id = $1
       ORDER BY t.sort_order, t.created_at`, [pid]),
    pool.query(
      `SELECT r.id, r.kind, r.name, r.description, r.impact, r.likelihood, r.status, r.created_at, r.updated_at,
              r.created_by, u.user_handle AS created_by_handle
       FROM project_raid r LEFT JOIN users u ON u.id = r.created_by
       WHERE r.project_id = $1
       ORDER BY (r.status = 'closed'), r.kind, r.created_at`, [pid]),
    pool.query('SELECT id, user_handle, user_full_name FROM users WHERE id = $1', [c.project.manager_id]),
    pool.query('SELECT id, name, sort_order FROM project_task_groups WHERE project_id = $1 ORDER BY sort_order, created_at', [pid]),
  ]);

  const sid = c.a.societyId;
  await openRows(sid, tasks, ['name', 'description', 'comments', 'doc_title', 'doc_file_name']);
  // A linked document in a sealed folder: opened from the Documents page, where its key is
  for (const t of tasks) if (t.doc_protection === 'sealed') { t.doc_title = 'Sealed document'; t.doc_file_name = null; }
  for (const t of tasks) if (t.latest_report) await openRows(sid, [t.latest_report], ['body']);
  await openRows(sid, raid, ['name', 'description']);
  await openRows(sid, groups, ['name']);
  // ?all=1 (to seal or unseal it): every status report's text, not just each task's latest
  let reports = null;
  if (req.nextUrl.searchParams.get('all') === '1' && c.canManage) {
    ({ rows: reports } = await pool.query(
      `SELECT r.id, r.body FROM project_status_reports r JOIN project_tasks t ON t.id = r.task_id WHERE t.project_id = $1`, [pid]));
    await openRows(sid, reports!, ['body']);
  }
  return NextResponse.json({
    project: { ...c.project, manager: mgr ?? null },
    tasks, raid, groups, reports,
    canSeal: c.canManage && c.a.isMember && await allowsSealed(sid),
    me: c.me,
    canManage: c.canManage, canModerate: c.a.canModerate, canContribute: c.canContribute, isManager: c.isManager,
  });
}

// PATCH — moderators edit anything (including the PM); the PM edits the
// description, dates and status.
async function handlePATCH(req: NextRequest, { params }: Params) {
  const { id, pid } = await params;
  const c = await projectContext(req, id, pid);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const sets: string[] = []; const vals: unknown[] = [];
  const set = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };

  if (c.a.canModerate) {
    if ('name' in b) { const n = ptext(c, b.name, 200); if (!n) return NextResponse.json({ error: 'A project name is required' }, { status: 400 }); set('name', await sealText(c.a.societyId, n)); }
    if ('managerId' in b) {
      if (b.managerId === null || b.managerId === '') set('manager_id', null);
      else if (typeof b.managerId === 'string' && UUID_RE.test(b.managerId) && await isSocietyMember(c.a.societyId, b.managerId)) set('manager_id', b.managerId);
      else return NextResponse.json({ error: 'The Project Manager must be a member of this Society' }, { status: 400 });
    }
  }
  if ('description' in b) set('description', await sealText(c.a.societyId, ptext(c, b.description, 5000)));
  if ('status' in b) {
    if (!(PROJECT_STATUSES as readonly string[]).includes(b.status)) return NextResponse.json({ error: 'Unknown status' }, { status: 400 });
    set('status', b.status);
  }
  const start = readDate(b.startDate), end = readDate(b.endDate);
  if (start !== undefined) set('start_date', start);
  if (end !== undefined) set('end_date', end);
  const s = start !== undefined ? start : c.project.start_date, e = end !== undefined ? end : c.project.end_date;
  if (s && e && e < s) return NextResponse.json({ error: 'The project must end after it starts' }, { status: 400 });
  if (sets.length) {
    vals.push(pid);
    await pool.query(`UPDATE projects SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals);
  }
  return NextResponse.json({ ok: true });
}

// DELETE — moderators (or SysAdmin as takedown) remove a project.
async function handleDELETE(req: NextRequest, { params }: Params) {
  const { id, pid } = await params;
  const c = await projectContext(req, id, pid);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.a.canTakeDown) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await pool.query('UPDATE projects SET deleted_at = now() WHERE id = $1', [pid]);
  return NextResponse.json({ ok: true });
}

export const PATCH = lockSafe(handlePATCH);
export const DELETE = lockSafe(handleDELETE);
