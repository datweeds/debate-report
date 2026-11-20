import { NextRequest, NextResponse } from 'next/server';
import { notifyNew } from '@/lib/notify';
import pool from '@/lib/db';
import { openRows, sealText } from '@/lib/societyCrypto';
import { discussionAccess, membersOnly } from '@/lib/discussions';
import { lockSafe } from '@/lib/lockSafe';
import { allowsSealed, getIdentity, readLocks, sealedMembers } from '@/lib/sealed/server';
import { UUID_RE } from '@/lib/discussions';

type Params = { params: Promise<{ id: string }> };

// GET — the Society's discussion threads, pinned first, then most recently active.
export async function GET(req: NextRequest, { params }: Params) {
  const a = await discussionAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.isMember && !a.canModerate && !a.breakGlass && !a.isDemo) return membersOnly(a.societyId, a.session);
  const { rows } = await pool.query(
    `SELECT t.id, t.title, t.created_at, t.last_post_at, t.pinned, t.locked, t.protection, t.sealed_epoch,
            u.user_handle AS author,
            (SELECT COUNT(*)::int FROM discussion_posts p WHERE p.thread_id = t.id AND p.deleted_at IS NULL) AS post_count,
            (SELECT lu.user_handle FROM discussion_posts lp LEFT JOIN users lu ON lu.id = lp.created_by
             WHERE lp.thread_id = t.id AND lp.deleted_at IS NULL ORDER BY lp.created_at DESC LIMIT 1) AS last_author,
            -- Messages by others since this viewer last opened the thread (never opened: the last 14 days)
            CASE WHEN $2::uuid IS NULL THEN 0 ELSE
              (SELECT COUNT(*)::int FROM discussion_posts np
               WHERE np.thread_id = t.id AND np.deleted_at IS NULL AND np.created_by IS DISTINCT FROM $2::uuid
                 AND np.created_at > COALESCE((SELECT seen_at FROM discussion_thread_seen ts WHERE ts.thread_id = t.id AND ts.user_id = $2::uuid),
                                              now() - interval '14 days')) END AS new_count
     FROM discussion_threads t LEFT JOIN users u ON u.id = t.created_by
     WHERE t.customer_id = $1 AND t.deleted_at IS NULL
     ORDER BY t.pinned DESC, t.last_post_at DESC
     LIMIT 200`,
    [a.societyId, a.session?.sub ?? null],
  );
  await openRows(a.societyId, rows, ['title']);
  return NextResponse.json({ threads: rows, canPost: a.canPost, canModerate: a.canModerate, allowSealed: await allowsSealed(a.societyId) });
}

// POST { title, body } — start a discussion. Sealed: { protection: 'sealed', id,
// title, body (both sealed in the browser, epoch 1), locks: [{ userId, lockedKey }] }.
async function createSealed(a: NonNullable<Awaited<ReturnType<typeof discussionAccess>>>, b: Record<string, unknown>) {
  const me = a.session!.sub;
  if (!await allowsSealed(a.societyId)) return NextResponse.json({ error: 'This Society doesn’t allow Sealed discussions' }, { status: 403 });
  if (!await getIdentity(me)) return NextResponse.json({ error: 'Set up secure access first' }, { status: 400 });
  const id = b.id, locks = readLocks(b.locks);
  const isE2E = (v: unknown, max: number) => typeof v === 'string' && v.length <= max && /^sn1:1:[A-Za-z0-9+/]+={0,2}$/.test(v);
  if (typeof id !== 'string' || !UUID_RE.test(id) || !isE2E(b.title, 2000) || !isE2E(b.body, 28000) || !locks?.some(l => l.userId === me)) {
    return NextResponse.json({ error: 'That sealed discussion wasn’t understood' }, { status: 400 });
  }
  const withKey = new Set((await sealedMembers(a.societyId)).filter(m => m.public_key).map(m => m.user_id));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
      `INSERT INTO discussion_threads (id, customer_id, title, created_by, protection, sealed_epoch) VALUES ($1, $2, $3, $4, 'sealed', 1)
       ON CONFLICT (id) DO NOTHING`, [id, a.societyId, b.title, me]);
    if (!rowCount) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Try again' }, { status: 409 }); }
    await client.query(`INSERT INTO discussion_posts (thread_id, body, created_by) VALUES ($1, $2, $3)`, [id, b.body, me]);
    for (const l of locks!) {
      if (!withKey.has(l.userId)) continue;
      await client.query(
        `INSERT INTO sealed_item_keys (item_type, item_id, epoch, user_id, locked_key, locked_by) VALUES ('thread', $1, 1, $2, $3, $4)`,
        [id, l.userId, l.lockedKey, me]);
    }
    await client.query('COMMIT');
    notifyNew({ societyId: a.societyId, kind: 'discussions', authorId: me, private: true, url: `/society/${a.societyId}/discussions/${id}` });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
}

async function handlePOST(req: NextRequest, { params }: Params) {
  const a = await discussionAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canPost || (!a.isMember && !a.canModerate)) return NextResponse.json({ error: 'Join this Society to start a discussion' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (b.protection === 'sealed') return createSealed(a, b);
  const { title, body } = b;
  if (typeof title !== 'string' || !title.trim()) return NextResponse.json({ error: 'A title is required' }, { status: 400 });
  if (typeof body !== 'string' || !body.trim()) return NextResponse.json({ error: 'Write something to start the discussion' }, { status: 400 });
  if (body.length > 5000) return NextResponse.json({ error: 'Message must be 5,000 characters or fewer' }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [t] } = await client.query(
      `INSERT INTO discussion_threads (customer_id, title, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [a.societyId, await sealText(a.societyId, title.trim().slice(0, 200), true), a.session!.sub],
    );
    await client.query(
      `INSERT INTO discussion_posts (thread_id, body, created_by) VALUES ($1, $2, $3)`,
      [t.id, await sealText(a.societyId, body.trim(), true), a.session!.sub],
    );
    await client.query('COMMIT');
    // Discussions are members-only: the notice never carries the title
    notifyNew({ societyId: a.societyId, kind: 'discussions', authorId: a.session!.sub, private: true, url: `/society/${a.societyId}/discussions/${t.id}` });
    return NextResponse.json({ id: t.id }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export const POST = lockSafe(handlePOST);
