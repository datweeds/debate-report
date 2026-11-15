import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { currentPrinciple, readPrinciple } from '@/lib/principles';

type Params = { params: Promise<{ id: string; pid: string }> };

// PATCH — moderators edit a principle ({ category, title, body, grounding })
// or move it ({ move: 'up' | 'down' }). Only the current version is editable.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, pid } = await params;
  const a = await societyContentAccess(req, id);
  const p = a ? await currentPrinciple(a.societyId, pid) : null;
  if (!a || !p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  if (body.move === 'up' || body.move === 'down') {
    const { rows: [other] } = await pool.query(
      `SELECT id, sort_order FROM society_principles
       WHERE version_id = $1 AND sort_order ${body.move === 'up' ? '<' : '>'} $2
       ORDER BY sort_order ${body.move === 'up' ? 'DESC' : 'ASC'} LIMIT 1`,
      [p.version_id, p.sort_order],
    );
    if (other) {
      await pool.query('UPDATE society_principles SET sort_order = $1 WHERE id = $2', [other.sort_order, p.id]);
      await pool.query('UPDATE society_principles SET sort_order = $1 WHERE id = $2', [p.sort_order, other.id]);
    }
    return NextResponse.json({ ok: true });
  }

  const v = readPrinciple(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  await pool.query(
    `UPDATE society_principles SET category = $1, title = $2, body = $3, grounding = $4, section = $6, updated_at = now() WHERE id = $5`,
    [v.category, v.title, v.body, v.grounding, p.id, v.section],
  );
  return NextResponse.json({ ok: true });
}

// DELETE — moderators remove a principle from the current version (earlier versions keep it).
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, pid } = await params;
  const a = await societyContentAccess(req, id);
  const p = a ? await currentPrinciple(a.societyId, pid) : null;
  if (!a || !p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await pool.query('DELETE FROM society_principles WHERE id = $1', [p.id]);
  return NextResponse.json({ ok: true });
}
