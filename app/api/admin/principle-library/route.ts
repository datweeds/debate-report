import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { readPrinciple } from '@/lib/principles';

// POST — SysAdmin adds a principle to the general library.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const p = readPrinciple(await req.clone().json().catch(() => ({})));
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  const body = await req.clone().json().catch(() => ({}));
  const library = typeof body.library === 'string' && body.library.trim() ? body.library.trim().slice(0, 60) : 'Debating';
  const { rows: [row] } = await pool.query(
    `INSERT INTO principle_library (library, section, sort_order, category, title, body, grounding)
     VALUES ($5, $6, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM principle_library), $1, $2, $3, $4) RETURNING id`,
    [p.category, p.title, p.body, p.grounding, library, p.section],
  );
  return NextResponse.json({ id: row.id }, { status: 201 });
}
