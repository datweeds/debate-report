import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export type Society = {
  id: number;
  name: string;
  subdomain: string;
  description: string | null;
  is_public: boolean;
  is_member: boolean;
};

export async function GET() {
  const session = await getSession().catch(() => null);

  const { rows } = await pool.query<{
    id: number;
    name: string;
    subdomain: string;
    description: string | null;
    is_public: boolean;
  }>(
    `SELECT id, name, subdomain, description, is_public
     FROM customers
     WHERE status = 'active' OR status IS NULL
     ORDER BY name`,
  ).catch(() => ({ rows: [] as { id: number; name: string; subdomain: string; description: string | null; is_public: boolean }[] }));

  let memberIds = new Set<number>();
  if (session) {
    const { rows: memberRows } = await pool.query<{ customer_id: number }>(
      `SELECT customer_id FROM customer_members WHERE user_id = $1`,
      [session.sub],
    ).catch(() => ({ rows: [] as { customer_id: number }[] }));
    memberIds = new Set(memberRows.map(r => r.customer_id));
  }

  const societies: Society[] = rows
    .filter(r => r.is_public || memberIds.has(r.id))
    .map(r => ({
      ...r,
      is_member: memberIds.has(r.id),
    }));

  return NextResponse.json(societies);
}
