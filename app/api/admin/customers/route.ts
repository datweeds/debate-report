import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { rows } = await pool.query(`
    SELECT
      c.id, c.name, c.subdomain, c.status, c.hero_image, c.hero_text,
      c.contact_email, c.platform_contact_email, c.created_at, c.updated_at,
      (SELECT COUNT(*)::int FROM proposals p WHERE p.tenant_id = c.id)       AS proposal_count,
      (SELECT COUNT(*)::int FROM sp_bill_debates sbd WHERE sbd.tenant_id = c.id) AS debate_count,
      (SELECT COUNT(*)::int FROM sp_proposal_debates spd WHERE spd.tenant_id = c.id) AS proposal_debate_count
    FROM customers c
    ORDER BY c.id
  `);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, subdomain, hero_text, contact_email, platform_contact_email } = await req.json();
  if (!name?.trim() || !subdomain?.trim()) {
    return NextResponse.json({ error: 'name and subdomain are required' }, { status: 400 });
  }

  const slug = subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

  const { rows: [customer] } = await pool.query(
    `INSERT INTO customers (name, subdomain, hero_text, contact_email, platform_contact_email)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [name.trim(), slug, hero_text?.trim() || null, contact_email?.trim() || null, platform_contact_email?.trim() || null]
  );

  return NextResponse.json({ id: customer.id }, { status: 201 });
}
