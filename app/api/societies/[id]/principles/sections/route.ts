import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { currentVersion } from '@/lib/principles';
import { openText, sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string }> };

// PATCH { from, to } — moderators rename a section across the current version
// ('to' empty moves its principles to "Other").
async function handlePATCH(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { from, to } = await req.json().catch(() => ({}));
  if (typeof from !== 'string') return NextResponse.json({ error: 'Which section?' }, { status: 400 });
  const v = await currentVersion(a.societyId);
  if (!v) return NextResponse.json({ error: 'No principles yet' }, { status: 400 });
  const target = typeof to === 'string' && to.trim() ? to.trim().slice(0, 80) : null;
  // Section names may be encrypted, so they're matched here rather than in SQL
  const { rows } = await pool.query('SELECT id, section FROM society_principles WHERE version_id = $1', [v.id]);
  const sealed = await sealText(a.societyId, target);
  let updated = 0;
  for (const r of rows) {
    if (((await openText(a.societyId, r.section)) || null) !== (from || null)) continue;
    await pool.query('UPDATE society_principles SET section = $1, updated_at = now() WHERE id = $2', [sealed, r.id]);
    updated++;
  }
  return NextResponse.json({ updated });
}

export const PATCH = lockSafe(handlePATCH);
