import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { ensureCurrentVersion } from '@/lib/principles';

type Params = { params: Promise<{ id: string }> };

// POST { libraryIds } — moderators copy principles from the general library
// into the Society's current version (they become the Society's own to edit).
export async function POST(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { libraryIds } = await req.json().catch(() => ({}));
  if (!Array.isArray(libraryIds) || !libraryIds.length || !libraryIds.every(x => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x))) {
    return NextResponse.json({ error: 'Choose at least one principle' }, { status: 400 });
  }
  const v = await ensureCurrentVersion(a.societyId, a.session!.sub);
  const { rowCount } = await pool.query(
    `INSERT INTO society_principles (version_id, sort_order, category, title, body, grounding)
     SELECT $1, (SELECT COALESCE(MAX(sort_order), 0) FROM society_principles WHERE version_id = $1)
                + ROW_NUMBER() OVER (ORDER BY l.sort_order),
            l.category, l.title, l.body, l.grounding
     FROM principle_library l WHERE l.id = ANY($2::uuid[])`,
    [v.id, libraryIds],
  );
  return NextResponse.json({ copied: rowCount }, { status: 201 });
}
