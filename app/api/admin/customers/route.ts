import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { rows } = await pool.query(`
    SELECT
      c.id, c.name, c.subdomain, c.status, c.hero_image, c.hero_text, c.description,
      c.contact_email, c.platform_contact_email, c.created_at, c.updated_at,
      c.is_public, c.visibility, c.is_default, c.is_demo,
      -- Open alerts/flags: scan alerts awaiting review, plus user flags not yet cleared
      ((SELECT COUNT(*) FROM content_alerts ca LEFT JOIN statements ar ON ar.id = ca.resolution_id
        WHERE ca.status = 'pending' AND COALESCE(ca.customer_id, ar.customer_id) = c.id)
     + (SELECT COUNT(*) FROM stat_flags sf JOIN statements fs ON fs.id = sf.stat_id LEFT JOIN statements fr ON fr.id = fs.resolution_id
        WHERE sf.resolved_at IS NULL AND COALESCE(fr.customer_id, fs.customer_id) = c.id))::int AS alert_count,
      (SELECT COUNT(*)::int FROM statements s WHERE s.stat_type = 'resolution' AND s.customer_id = c.id) AS debate_count
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

  // The Sys Admin who creates a Society runs it and belongs to it, as when a moderator creates one
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [customer] } = await client.query(
      `INSERT INTO customers (name, subdomain, hero_text, contact_email, platform_contact_email, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name.trim(), slug, hero_text?.trim() || null, contact_email?.trim() || null, platform_contact_email?.trim() || null, session.sub]
    );
    await client.query(`INSERT INTO customer_roles (tenant_id, user_id, role) VALUES ($1, $2, 'customer_admin')`, [customer.id, session.sub]);
    await client.query(`INSERT INTO customer_members (customer_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [customer.id, session.sub]);
    await client.query('COMMIT');
    return NextResponse.json({ id: customer.id }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
