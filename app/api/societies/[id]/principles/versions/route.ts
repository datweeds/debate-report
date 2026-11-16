import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { currentVersion } from '@/lib/principles';
import { sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string }> };

// POST { changeNote } — moderators publish a new version: the current principles
// are copied into it (keeping their lineage, so discussions and debates follow)
// and the old version becomes read-only history.
async function handlePOST(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { changeNote } = await req.json().catch(() => ({}));
  if (typeof changeNote !== 'string' || !changeNote.trim()) {
    return NextResponse.json({ error: 'Say what changes in this version' }, { status: 400 });
  }
  const note = await sealText(a.societyId, changeNote.trim().slice(0, 2000));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await currentVersion(a.societyId, client);
    if (!cur) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Add some principles first' }, { status: 400 }); }
    await client.query('UPDATE society_principle_versions SET is_current = FALSE WHERE id = $1', [cur.id]);
    const { rows: [nv] } = await client.query(
      `INSERT INTO society_principle_versions (customer_id, version, change_note, is_current, created_by)
       VALUES ($1, $2, $3, TRUE, $4) RETURNING id, version`,
      [a.societyId, cur.version + 1, note, a.session!.sub],
    );
    await client.query(
      `INSERT INTO society_principles (version_id, lineage_id, sort_order, category, section, title, body, grounding)
       SELECT $1, lineage_id, sort_order, category, section, title, body, grounding FROM society_principles WHERE version_id = $2`,
      [nv.id, cur.id],
    );
    await client.query('COMMIT');
    return NextResponse.json({ version: nv.version }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export const POST = lockSafe(handlePOST);
