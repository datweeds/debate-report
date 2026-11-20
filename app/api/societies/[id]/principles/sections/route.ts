import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { currentVersion, principlesSealedCheck } from '@/lib/principles';
import { openText, sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string }> };

// PATCH { from, to } — moderators rename a section across the current version
// ('to' empty moves its principles to "Other").
async function handlePATCH(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { from, to, ids } = await req.json().catch(() => ({}));
  const v = await currentVersion(a.societyId);
  if (!v) return NextResponse.json({ error: 'No principles yet' }, { status: 400 });
  // Sealed: the server can't read section names, so the browser says which
  // principles to move and sends the new name already sealed (or '' for "Other")
  const sealedCheck = await principlesSealedCheck(a.societyId);
  if (sealedCheck) {
    if (!Array.isArray(ids) || !ids.every(x => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)) || !(to === '' || sealedCheck(to))) {
      return NextResponse.json({ error: 'That wasn’t understood' }, { status: 400 });
    }
    const { rowCount } = await pool.query('UPDATE society_principles SET section = $1, updated_at = now() WHERE version_id = $2 AND id = ANY($3::uuid[])',
      [to || null, v.id, ids]);
    return NextResponse.json({ updated: rowCount });
  }
  if (typeof from !== 'string') return NextResponse.json({ error: 'Which section?' }, { status: 400 });
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
