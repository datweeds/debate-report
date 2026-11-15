import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string; inviteId: string }> };

// The invitee accepts or declines their own invitation.
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id, inviteId } = await params;
  const { action } = await req.json();
  if (action !== 'accept' && action !== 'decline') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const { rows: [invite] } = await pool.query(
    `UPDATE debate_invitations SET status = $1, updated_at = now()
     WHERE id = $2 AND resolution_id = $3 AND invitee_user_id = $4 AND status = 'pending'
     RETURNING id`,
    [action === 'accept' ? 'accepted' : 'declined', inviteId, id, session.sub]
  );
  if (!invite) return NextResponse.json({ error: 'Invitation not found or already responded' }, { status: 404 });

  if (action === 'accept') {
    await pool.query(
      `INSERT INTO debate_members (resolution_id, user_id, member_status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (resolution_id, user_id) DO UPDATE SET member_status = 'active', updated_at = now()`,
      [id, session.sub]
    );
  }

  return NextResponse.json({ ok: true });
}
