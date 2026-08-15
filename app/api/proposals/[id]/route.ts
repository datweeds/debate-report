import { NextRequest, NextResponse } from 'next/server';
import pool, { tq } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

function canView(session: { sub: string; isSysAdmin: boolean } | null, p: { status: string; proposer_id: string }): boolean {
  if (p.status === 'accepted') return true;
  if (!session) return false;
  if (session.isSysAdmin) return true;
  return session.sub === p.proposer_id;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);

  const { rows: [p] } = await tq<{ status: string; proposer_id: string }>(
    `SELECT p.*, nt.name AS topic_name
     FROM proposals p
     LEFT JOIN nsp_topics nt ON nt.id = p.topic_id
     WHERE p.id = $1`,
    [id]
  );
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canView(session, p)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json(p);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  const { rows: [p] } = await tq(`SELECT * FROM proposals WHERE id = $1`, [id]);
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'accept' || action === 'reject') {
    if (!session.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!['proposed', 'amended'].includes(p.status)) {
      return NextResponse.json({ error: 'Invalid status transition' }, { status: 400 });
    }
    if (action === 'accept') {
      await tq(
        `UPDATE proposals SET status = 'accepted', rejection_reason = NULL, updated_at = now() WHERE id = $1`,
        [id]
      );
    } else {
      const { reason } = body;
      if (!reason?.trim()) return NextResponse.json({ error: 'reason is required' }, { status: 400 });
      await tq(
        `UPDATE proposals SET status = 'rejected', rejection_reason = $1, updated_at = now() WHERE id = $2`,
        [reason.trim(), id]
      );
    }
  } else if (action === 'amend') {
    if (session.sub !== p.proposer_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (p.status !== 'rejected') {
      return NextResponse.json({ error: 'Can only amend a rejected proposal' }, { status: 400 });
    }
    const { title, description } = body;
    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: 'title and description are required' }, { status: 400 });
    }
    await tq(
      `UPDATE proposals SET status = 'amended', title = $1, description = $2,
       rejection_reason = NULL, updated_at = now() WHERE id = $3`,
      [title.trim(), description.trim(), id]
    );
  } else if (action === 'resolve') {
    if (!session.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (p.status !== 'accepted') {
      return NextResponse.json({ error: 'Can only resolve an accepted proposal' }, { status: 400 });
    }
    if (p.next_action) {
      return NextResponse.json({ error: 'Proposal already resolved' }, { status: 409 });
    }
    const { resolution, statement, closesAt } = body;
    if (!['closed', 'debate', 'vote'].includes(resolution)) {
      return NextResponse.json({ error: 'Invalid resolution' }, { status: 400 });
    }
    if (!statement?.trim()) return NextResponse.json({ error: 'statement is required' }, { status: 400 });

    let votePollId: string | null = null;

    if (resolution === 'vote') {
      const entityUrl = `${process.env.SCOTPARL_BASE_URL ?? 'https://staging.debate.report'}/scotparl/proposals/${id}`;
      const question  = `The question you are asked is whether or not you agree with the resolution debated: ${p.title}`;
      const { rows: [poll] } = await pool.query(
        `INSERT INTO vc_polls (title, question, entity_type, entity_id, entity_url, closes_at, created_by)
         VALUES ($1, $2, 'proposal', $3, $4, $5, $6::uuid)
         RETURNING id`,
        [p.title, question, id, entityUrl, closesAt || null, session.sub]
      );
      votePollId = poll.id;
    }

    await tq(
      `UPDATE proposals SET next_action = $1, next_action_statement = $2,
       next_action_at = now(), updated_at = now(), vote_poll_id = $3 WHERE id = $4`,
      [resolution, statement.trim(), votePollId, id]
    );
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
