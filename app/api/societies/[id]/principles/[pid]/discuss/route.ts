import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { currentPrinciple } from '@/lib/principles';

type Params = { params: Promise<{ id: string; pid: string }> };

// POST — the principle's discussion thread, created on first use.
export async function POST(req: NextRequest, { params }: Params) {
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [t] } = await client.query(
      `INSERT INTO discussion_threads (customer_id, title, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [a.societyId, `Principle: ${p.title}`.slice(0, 200), a.session!.sub],
    );
    await client.query(
      `INSERT INTO discussion_posts (thread_id, body, created_by) VALUES ($1, $2, $3)`,
      [t.id, `${p.body}${p.grounding ? `\n\nWhy: ${p.grounding}` : ''}\n\nDiscuss this principle here.`, a.session!.sub],
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
