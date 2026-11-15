import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { currentVersion } from '@/lib/principles';

type Params = { params: Promise<{ id: string }> };

// PATCH { from, to } — moderators rename a section across the current version
// ('to' empty moves its principles to "Other").
export async function PATCH(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { from, to } = await req.json().catch(() => ({}));
  if (typeof from !== 'string') return NextResponse.json({ error: 'Which section?' }, { status: 400 });
  const v = await currentVersion(a.societyId);
  if (!v) return NextResponse.json({ error: 'No principles yet' }, { status: 400 });
  const target = typeof to === 'string' && to.trim() ? to.trim().slice(0, 80) : null;
  const { rowCount } = await pool.query(
    'UPDATE society_principles SET section = $1, updated_at = now() WHERE version_id = $2 AND section IS NOT DISTINCT FROM $3',
    [target, v.id, from || null],
  );
  return NextResponse.json({ updated: rowCount });
}
