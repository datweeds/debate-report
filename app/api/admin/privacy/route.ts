import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { reencryptSociety } from '@/lib/societyRekey';
import { lockSafe } from '@/lib/lockSafe';

// POST — bring every Society's stored content in line with its privacy
// (encrypt private Societies' content, decrypt public ones'). Safe to rerun. SysAdmin.
async function handlePOST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { rows } = await pool.query('SELECT id, name, visibility FROM customers ORDER BY id');
  const results = [];
  for (const c of rows) results.push({ id: c.id, name: c.name, visibility: c.visibility, changed: await reencryptSociety(c.id) });
  return NextResponse.json({ results });
}

export const POST = lockSafe(handlePOST);
