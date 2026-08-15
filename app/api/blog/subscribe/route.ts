import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
  const { email, name } = await req.json().catch(() => ({}));

  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  try {
    // Upsert: re-activate if previously unsubscribed
    await pool.query(
      `INSERT INTO blog_subscribers (email, name)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE
         SET name            = EXCLUDED.name,
             active          = true,
             unsubscribed_at = NULL`,
      [email.trim().toLowerCase(), name?.trim() || null],
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('[blog/subscribe]', err);
    return NextResponse.json({ error: 'Could not subscribe' }, { status: 500 });
  }
}
