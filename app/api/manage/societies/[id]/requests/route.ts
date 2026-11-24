import { NextRequest, NextResponse } from 'next/server';
import { areaJoinProblem } from '@/lib/ageCheck';
import pool from '@/lib/db';
import { addMember, moderatedSociety } from '@/lib/societies';
import { notifyJoinDecision } from '@/lib/joinNotice';

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
  if (action === 'approve') {
    // A local Society: the member must (still) be a confirmed adult
    const problem = await areaJoinProblem(jr.user_id, ctx.id);
    if (problem) {
      await pool.query(`UPDATE society_join_requests SET status = 'pending', decided_by = NULL, decided_at = NULL WHERE id = $1`, [requestId]);
      return NextResponse.json({ error: problem === 'CHECK' ? 'They need to confirm their age before joining a local Society. They’ll be asked when they next sign in.' : 'This member can’t join a local Society: it’s for people aged 18 and over.' }, { status: 409 });
    }
    await addMember(ctx.id, jr.user_id);
  }
  void notifyJoinDecision(jr.user_id, ctx.id, action === 'approve', 'society');
  return NextResponse.json({ ok: true });
}
