import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { lookupAccessKey, accessKeyCookie } from '@/lib/accessKeys';

type Params = { params: Promise<{ key: string }> };

// /key/<key> — the link a SysAdmin sends to an Access Key recipient. Stores
// the key in a cookie (works on any device until revoked or expired) and
// opens the first debate it unlocks.
//
// Redirects use a relative Location: behind nginx, req.url carries the
// internal host (localhost:3004), not the public one.
function redirectTo(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { key: raw } = await params;
  const key = await lookupAccessKey(raw);
  if (!key) return redirectTo('/key/invalid');

  await pool.query(
    `UPDATE access_keys
     SET first_used_at = COALESCE(first_used_at, now()), last_used_at = now(), use_count = use_count + 1
     WHERE id = $1`,
    [key.id],
  );

  const [first] = key.resolutionIds;
  const res = redirectTo(first ? `/chamber?resolution=${first}` : '/');
  res.cookies.set(accessKeyCookie(raw, key.expiresAt));
  return res;
}
