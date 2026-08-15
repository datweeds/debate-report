import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({}));

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE blog_subscribers
       SET active = false, unsubscribed_at = NOW()
       WHERE unsubscribe_token = $1 AND active = true`,
      [token],
    );

    if (!rowCount) {
      return NextResponse.json({ error: 'Token not found or already unsubscribed' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[blog/unsubscribe]', err);
    return NextResponse.json({ error: 'Could not unsubscribe' }, { status: 500 });
  }
}
