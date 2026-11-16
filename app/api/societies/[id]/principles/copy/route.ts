import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { ensureCurrentVersion } from '@/lib/principles';
import { sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string }> };

// POST { libraryIds } — moderators copy principles from the general library
// into the Society's current version (they become the Society's own to edit).
async function handlePOST(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { libraryIds } = await req.json().catch(() => ({}));
  if (!Array.isArray(libraryIds) || !libraryIds.length || !libraryIds.every(x => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x))) {
    return NextResponse.json({ error: 'Choose at least one principle' }, { status: 400 });
  }
  const v = await ensureCurrentVersion(a.societyId, a.session!.sub);
  // Copied one by one: a private Society stores its copy encrypted
  const { rows: lib } = await pool.query(
    'SELECT category, section, title, body, grounding FROM principle_library WHERE id = ANY($1::uuid[]) ORDER BY sort_order', [libraryIds]);
  const { rows: [m] } = await pool.query('SELECT COALESCE(MAX(sort_order), 0)::int AS n FROM society_principles WHERE version_id = $1', [v.id]);
  const seal = (t: string | null) => sealText(a.societyId, t);
  for (const [i, l] of lib.entries()) {
    await pool.query(
      `INSERT INTO society_principles (version_id, sort_order, category, section, title, body, grounding) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [v.id, m.n + i + 1, l.category, await seal(l.section), await seal(l.title), await seal(l.body), await seal(l.grounding)]);
  }
  return NextResponse.json({ copied: lib.length }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
