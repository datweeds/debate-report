import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;
  const { request_text } = await req.json();
  if (!request_text?.trim()) {
    return NextResponse.json({ error: 'request_text is required' }, { status: 400 });
  }

  const { rows: [r] } = await pool.query(
    `INSERT INTO nsp_review_requests (principle_id, user_id, user_handle, request_text)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [id, session.sub, session.handle, request_text.trim()]
  );
  return NextResponse.json({ id: r.id });
}
