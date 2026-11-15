import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { addMember, moderatedSociety } from '@/lib/societies';

type Params = { params: Promise<{ id: string }> };

// PATCH { requestId, action: 'approve' | 'reject' } — decide a request to join.
export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await moderatedSociety(req, params);
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { requestId, action } = await req.json().catch(() => ({}));
  if (!['approve', 'reject'].includes(action) || typeof requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return NextResponse.json({ error: 'requestId and action are required' }, { status: 400 });
  }
  const { rows: [jr] } = await pool.query(
    `UPDATE society_join_requests SET status = $3, decided_by = $4, decided_at = now()
     WHERE id = $1 AND customer_id = $2 AND status = 'pending' RETURNING user_id`,
    [requestId, ctx.id, action === 'approve' ? 'approved' : 'rejected', ctx.session.sub],
  );
  if (!jr) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  if (action === 'approve') await addMember(ctx.id, jr.user_id);
  return NextResponse.json({ ok: true });
}
