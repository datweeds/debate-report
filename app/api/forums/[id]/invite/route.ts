import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

const FREE_INVITE_CAP = 6;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://staging.debate.report';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows: [forum] } = await pool.query(
    `SELECT id, forum_title, forum_visibility, is_system_forum, forum_type
     FROM debate_forums WHERE id = $1 AND forum_owner = $2 AND forum_status != 'deleted'`,
    [id, session.sub]
  );
  if (!forum) return NextResponse.json({ error: 'Forum not found' }, { status: 404 });

  // Free-tier cap: system forum max 6 active+accepted invitations
  if (session.plan === 'free' && !session.isSysAdmin && forum.is_system_forum) {
    const { rows: [capRow] } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM invitations
       WHERE forum_id = $1 AND invitation_status IN ('open', 'accepted')`,
      [id]
    );
    if (capRow.n >= FREE_INVITE_CAP) {
      return NextResponse.json({
        error: `Free accounts can invite up to ${FREE_INVITE_CAP} people to their personal forum`,
      }, { status: 403 });
    }
  }

  const { inviteeEmail, message } = await req.json();
  const token = crypto.randomUUID();

  const { rows: [invitation] } = await pool.query(
    `INSERT INTO invitations
       (created_by, forum_id, invited_role, invitation_status, token, invitee_email, invitation_message)
     VALUES ($1, $2, 'debater', 'open', $3, $4, $5)
     RETURNING id, token, invitee_email, invitation_message, invitation_status, created_at`,
    [session.sub, id, token, inviteeEmail?.trim() || null, message?.trim() || null]
  );

  return NextResponse.json({
    invitation,
    url: `${BASE_URL}/invite/${token}`,
  }, { status: 201 });
}

// GET: list invitations for this forum (owner only)
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows: [forum] } = await pool.query(
    `SELECT id FROM debate_forums WHERE id = $1 AND forum_owner = $2 AND forum_status != 'deleted'`,
    [id, session.sub]
  );
  if (!forum) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows } = await pool.query(
    `SELECT id, invitee_email, invitation_message, invitation_status, token, created_at
     FROM invitations WHERE forum_id = $1 ORDER BY created_at DESC`,
    [id]
  );

  const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://staging.debate.report';
  return NextResponse.json(rows.map(r => ({ ...r, url: `${BASE}/invite/${r.token}` })));
}
