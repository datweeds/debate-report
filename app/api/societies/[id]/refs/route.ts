import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { getSocietyAccess } from '@/lib/societies';
import { resolveSocietyId } from '@/lib/societyRef';
import { openRows } from '@/lib/societyCrypto';
import { sealRoots } from '@/lib/sealed/folders';
import { sealedSection } from '@/lib/sealed/server';
import { isRefId, refKey, REF_KINDS, type RefInfo, type RefKind } from '@/lib/refs';

type Params = { params: Promise<{ id: string }> };
const LIST_LIMIT = 500;

// GET ?r=note:<id>,event:<id>,… — what this person may see of each referenced
// item (anything deleted, or that they can't open, is simply left out).
// GET ?list=1 — every item they could reference, newest first (for the picker).
// Sealed items' text comes back sealed; the browser opens it with the reader's keys.
export async function GET(req: NextRequest, { params }: Params) {
  // A reference may name the Society rather than give its number
  const societyId = await resolveSocietyId((await params).id).catch(() => null);
  if (societyId == null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const session = await getSessionFromRequest(req);
  const access = await getSocietyAccess(session, societyId);
  if (!access?.canEnter) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const inside = access.isMember || access.isModerator;
  const may: Record<RefKind, boolean> = {
    note: !access.disabled.includes('documents'),
    doc: !access.disabled.includes('documents'),
    event: !access.disabled.includes('events'),
    // Discussions are members-only
    thread: !access.disabled.includes('discussions') && (inside || !!access.breakGlass || access.isDemo),
  };

  const list = req.nextUrl.searchParams.get('list') === '1';
  const wanted: Record<RefKind, string[]> = { note: [], doc: [], event: [], thread: [] };
  if (!list) {
    for (const part of (req.nextUrl.searchParams.get('r') ?? '').split(',').slice(0, 50)) {
      const [k, id] = part.split(':');
      if ((REF_KINDS as string[]).includes(k) && isRefId(id)) wanted[k as RefKind].push(id.toLowerCase());
    }
  }
  const docIds = [...wanted.note, ...wanted.doc];
  const want = (ids: string[]) => list || ids.length > 0;
  const out: RefInfo[] = [];

  if (may.doc && want(docIds)) {
    const { rows } = await pool.query(
      `SELECT d.id, d.kind, d.title, d.description, d.url, d.file_name, d.mime_type, d.size_bytes, d.folder_id,
              d.protection, d.created_at, u.user_handle AS author
       FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.customer_id = $1 AND d.deleted_at IS NULL ${list ? '' : 'AND d.id = ANY($2::uuid[])'}
       ORDER BY d.created_at DESC LIMIT ${LIST_LIMIT}`,
      list ? [societyId] : [societyId, docIds]);
    await openRows(societyId, rows.filter(r => r.protection !== 'sealed'), ['title', 'description', 'url', 'file_name']);
    const roots = rows.some(r => r.protection === 'sealed') ? await sealRoots(societyId) : new Map();
    for (const d of rows) {
      const root = d.protection === 'sealed' && d.folder_id ? roots.get(d.folder_id) : null;
      // Asked for as a note but isn't one (or the other way round): give it as it is
      out.push({
        society: societyId, kind: d.kind === 'note' ? 'note' : 'doc', id: d.id, title: d.title,
        sealed: root ? { type: 'folder', id: root.id } : null,
        created_at: d.created_at, author: d.author,
        docKind: d.kind, description: d.description, url: d.kind === 'link' ? d.url : null,
        file_name: d.file_name, mime_type: d.mime_type, size_bytes: d.size_bytes, folder_id: d.folder_id,
      });
    }
  }

  if (may.event && want(wanted.event)) {
    const { rows } = await pool.query(
      `SELECT e.id, e.title, e.description, e.location, e.starts_at, e.ends_at, e.all_day, e.created_at, u.user_handle AS author
       FROM society_events e LEFT JOIN users u ON u.id = e.created_by
       WHERE e.customer_id = $1 AND e.deleted_at IS NULL ${list ? '' : 'AND e.id = ANY($2::uuid[])'}
       ORDER BY e.starts_at DESC LIMIT ${LIST_LIMIT}`,
      list ? [societyId] : [societyId, wanted.event]);
    await openRows(societyId, rows, ['title', 'description', 'location']);
    const cal = rows.length ? await sealedSection(societyId, 'calendar') : null;
    for (const e of rows) out.push({
      society: societyId, kind: 'event', id: e.id, title: e.title, sealed: cal ? { type: 'calendar', id: cal.id } : null,
      created_at: e.created_at, author: e.author,
      description: e.description, location: e.location, starts_at: e.starts_at, ends_at: e.ends_at, all_day: e.all_day,
    });
  }

  if (may.thread && want(wanted.thread)) {
    const { rows } = await pool.query(
      `SELECT t.id, t.title, t.protection, t.locked, t.created_at, u.user_handle AS author,
              (SELECT COUNT(*)::int FROM discussion_posts p WHERE p.thread_id = t.id AND p.deleted_at IS NULL) AS posts
              ${list ? '' : `, (SELECT p.body FROM discussion_posts p WHERE p.thread_id = t.id AND p.deleted_at IS NULL ORDER BY p.created_at LIMIT 1) AS first`}
       FROM discussion_threads t LEFT JOIN users u ON u.id = t.created_by
       WHERE t.customer_id = $1 AND t.deleted_at IS NULL ${list ? '' : 'AND t.id = ANY($2::uuid[])'}
       ORDER BY t.last_post_at DESC NULLS LAST LIMIT ${LIST_LIMIT}`,
      list ? [societyId] : [societyId, wanted.thread]);
    await openRows(societyId, rows, list ? ['title'] : ['title', 'first']);
    for (const t of rows) out.push({
      society: societyId, kind: 'thread', id: t.id, title: t.title, sealed: t.protection === 'sealed' ? { type: 'thread', id: t.id } : null,
      created_at: t.created_at, author: t.author, posts: t.posts, first: t.first ?? null, locked: t.locked,
    });
  }

  const res = NextResponse.json(list
    ? { items: out.map(({ description: _d, url: _u, first: _f, location: _l, ...rest }) => rest) }
    : { items: Object.fromEntries(out.flatMap(i => i.kind === 'note' || i.kind === 'doc'
        // a document can be asked for as a note or a document: the answer says which it is
        ? [[`note:${i.id}`, i], [`doc:${i.id}`, i]] : [[refKey(i), i]])) });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
