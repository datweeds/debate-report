import { NextRequest, NextResponse } from 'next/server';
import { principlesSealedCheck } from '@/lib/principles';
import { sealedThread } from '@/lib/sealed/server';
import pool from '@/lib/db';
import { sealText } from '@/lib/societyCrypto';
import { societyContentAccess } from '@/lib/societies';
import { currentPrinciple } from '@/lib/principles';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; pid: string }> };

// POST — the principle's discussion thread, created on first use.
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, pid } = await params;
  const a = await societyContentAccess(req, id);
  const p = a ? await currentPrinciple(a.societyId, pid) : null;
  if (!a || !p) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows: [link] } = await pool.query(
    `SELECT l.thread_id FROM society_principle_links l
     JOIN discussion_threads t ON t.id = l.thread_id AND t.deleted_at IS NULL
     WHERE l.lineage_id = $1`, [p.lineage_id]);
  if (link?.thread_id) return NextResponse.json({ threadId: link.thread_id });
  if (!a.canPost) return NextResponse.json({ error: 'Join this Society to start the discussion' }, { status: 403 });

  // Sealed principles: the browser starts a sealed discussion with the principle's
  // text and asks for it to be linked here ({ threadId })
  if (await principlesSealedCheck(a.societyId)) {
    const { threadId } = await req.json().catch(() => ({}));
    const t = typeof threadId === 'string' ? await sealedThread(a.societyId, threadId) : null;
    if (!t) return NextResponse.json({ error: 'Start a sealed discussion for it', sealed: true }, { status: 409 });
    await pool.query(
      `INSERT INTO society_principle_links (lineage_id, customer_id, thread_id) VALUES ($1, $2, $3)
       ON CONFLICT (lineage_id) DO UPDATE SET thread_id = EXCLUDED.thread_id`, [p.lineage_id, a.societyId, t.id]);
    return NextResponse.json({ threadId: t.id }, { status: 201 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [t] } = await client.query(
      `INSERT INTO discussion_threads (customer_id, title, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [a.societyId, await sealText(a.societyId, `Principle: ${p.title}`.slice(0, 200), true), a.session!.sub],
    );
    await client.query(
      `INSERT INTO discussion_posts (thread_id, body, created_by) VALUES ($1, $2, $3)`,
      [t.id, await sealText(a.societyId, `${p.body}${p.grounding ? `\n\nWhy: ${p.grounding}` : ''}\n\nDiscuss this principle here.`, true), a.session!.sub],
    );
    await client.query(
      `INSERT INTO society_principle_links (lineage_id, customer_id, thread_id) VALUES ($1, $2, $3)
       ON CONFLICT (lineage_id) DO UPDATE SET thread_id = EXCLUDED.thread_id`,
      [p.lineage_id, a.societyId, t.id],
    );
    await client.query('COMMIT');
    return NextResponse.json({ threadId: t.id }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export const POST = lockSafe(handlePOST);
