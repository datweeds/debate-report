import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET — the general-purpose principles library (for Moderators copying into a Society).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { rows } = await pool.query(
    'SELECT id, sort_order, category, title, body, grounding FROM principle_library ORDER BY sort_order, created_at',
  );
  return NextResponse.json({ principles: rows });
}
