import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { moderatedSocietyIds } from '@/lib/roles';
import { copyDebate, moveDebate } from '@/lib/portability';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string }> };

// POST { targetSocietyId, mode: 'move' | 'copy', includeVotes, includeChat }
// — a moderator of both Societies moves or copies a debate between them.
// Everything else (statements, references, links, analyses, fallacy tags)
// always goes with it; votes and chat are optional.
async function handlePOST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const target = Number(b.targetSocietyId);
  const mode = b.mode === 'copy' ? 'copy' : b.mode === 'move' ? 'move' : null;
  if (!mode || !target) return NextResponse.json({ error: 'Choose a Society and whether to move or copy' }, { status: 400 });

  const { rows: [debate] } = await pool.query(
    `SELECT id, customer_id, stat_title FROM statements WHERE id = $1 AND stat_type = 'resolution' AND stat_status <> 'deleted'`, [id],
  );
  if (!debate) return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
  const mine = await moderatedSocietyIds(session.sub);
  if (!mine.includes(debate.customer_id) || !mine.includes(target)) {
    return NextResponse.json({ error: 'You must moderate both Societies' }, { status: 403 });
  }
  if (mode === 'move' && target === debate.customer_id) return NextResponse.json({ error: 'It is already in that Society' }, { status: 400 });

  const opts = { includeVotes: b.includeVotes !== false, includeChat: b.includeChat !== false };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultId = mode === 'copy' ? await copyDebate(client, id, target, opts) : (await moveDebate(client, id, target, opts), id);
    await client.query('COMMIT');
    const { rows: [soc] } = await pool.query('SELECT name FROM customers WHERE id = $1', [target]);
    return NextResponse.json({ id: resultId, mode, society_name: soc?.name ?? null }, { status: mode === 'copy' ? 201 : 200 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('debate transfer failed:', err);
    return NextResponse.json({ error: `The ${mode} failed; nothing was changed` }, { status: 500 });
  } finally {
    client.release();
  }
}

export const POST = lockSafe(handlePOST);
