import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAccessKeyFromCookies, clearAccessKeyCookie } from '@/lib/accessKeys';
import { hideEndToEnd, openDeep } from '@/lib/societyCrypto';

// The visitor's current Access Key (for the "Guest access" chip in the header),
// and DELETE to end guest access on this device.
export async function GET() {
  const key = await getAccessKeyFromCookies();
  if (!key) return NextResponse.json(null);
  const { rows } = await pool.query(
    `SELECT s.id, s.stat_title FROM access_key_debates akd
     JOIN statements s ON s.id = akd.resolution_id
     WHERE akd.key_id = $1 ORDER BY s.stat_title`,
    [key.id],
  );
  await openDeep(rows);
  await hideEndToEnd(rows);  // sealed debates: only members' browsers can open them
  rows.sort((a, b) => String(a.stat_title).localeCompare(String(b.stat_title)));
  return NextResponse.json({ id: key.id, label: key.label, expiresAt: key.expiresAt, debates: rows });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearAccessKeyCookie());
  return res;
}
