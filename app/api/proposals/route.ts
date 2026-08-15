import { NextRequest, NextResponse } from 'next/server';
import { tq } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);

  let rows;
  if (session?.isSysAdmin) {
    ({ rows } = await tq(
      `SELECT p.id, p.title, p.status, p.proposer_id, p.proposer_handle,
              p.rejection_reason, p.topic_id, p.created_at, p.updated_at,
              nt.name AS topic_name
       FROM proposals p
       LEFT JOIN nsp_topics nt ON nt.id = p.topic_id
       ORDER BY
         CASE p.status WHEN 'amended' THEN 1 WHEN 'proposed' THEN 2
           WHEN 'accepted' THEN 3 WHEN 'rejected' THEN 4 END,
         p.updated_at DESC`
    ));
  } else if (session) {
    ({ rows } = await tq(
      `SELECT p.id, p.title, p.status, p.proposer_id, p.proposer_handle,
              p.rejection_reason, p.topic_id, p.created_at, p.updated_at,
              nt.name AS topic_name
       FROM proposals p
       LEFT JOIN nsp_topics nt ON nt.id = p.topic_id
       WHERE p.status = 'accepted' OR p.proposer_id = $1
       ORDER BY p.updated_at DESC`,
      [session.sub]
    ));
  } else {
    ({ rows } = await tq(
      `SELECT p.id, p.title, p.status, p.proposer_id, p.proposer_handle,
              p.topic_id, p.created_at,
              nt.name AS topic_name
       FROM proposals p
       LEFT JOIN nsp_topics nt ON nt.id = p.topic_id
       WHERE p.status = 'accepted'
       ORDER BY p.created_at DESC`
    ));
  }

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { title, description, topic_id } = await req.json();
  if (!title?.trim() || !description?.trim()) {
    return NextResponse.json({ error: 'title and description are required' }, { status: 400 });
  }

  const { rows: [p] } = await tq(
    `INSERT INTO proposals (title, description, topic_id, proposer_id, proposer_handle)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [title.trim(), description.trim(), topic_id || null, session.sub, session.handle]
  );

  return NextResponse.json({ id: p.id }, { status: 201 });
}
