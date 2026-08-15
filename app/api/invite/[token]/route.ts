import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

type Params = { params: Promise<{ token: string }> };

// GET — public, no auth: fetch invitation details for the landing page
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;

  const { rows: [row] } = await pool.query(
    `SELECT i.id, i.invitation_status, i.invitee_email, i.invitation_message,
            f.id AS forum_id, f.forum_title, f.forum_description, f.forum_visibility,
            u.user_handle AS owner_handle, u.user_full_name AS owner_name
     FROM   invitations i
     JOIN   debate_forums f ON f.id = i.forum_id
     JOIN   users u ON u.id = i.created_by
     WHERE  i.token = $1`,
    [token]
  );

  if (!row) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  if (row.invitation_status === 'rejected') {
    return NextResponse.json({ error: 'This invitation has already been declined' }, { status: 410 });
  }
  if (row.invitation_status === 'accepted') {
    return NextResponse.json({ error: 'This invitation has already been accepted' }, { status: 410 });
  }
  if (row.invitation_status === 'expired') {
    return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
  }

  return NextResponse.json(row);
}

// POST — decline invitation (no auth needed)
export async function POST(_req: NextRequest, { params }: Params) {
  const { token } = await params;

  const { rows: [row] } = await pool.query(
    `UPDATE invitations SET invitation_status = 'rejected'
     WHERE token = $1 AND invitation_status = 'open'
     RETURNING id`,
    [token]
  );

  if (!row) return NextResponse.json({ error: 'Invitation not found or already responded' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
