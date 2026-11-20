import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { slugify } from '@/lib/societies';
import { slugAvailable, slugProblem } from '@/lib/societyRef';

const VISIBILITIES = ['public', 'apply', 'invite'];

// GET — Societies this user moderates, and whether they may create more
// (creating a Society is a Moderator-tier capability).
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.visibility, c.hero_text, c.status,
            (SELECT COUNT(*)::int FROM customer_members m WHERE m.customer_id = c.id) AS member_count,
            (SELECT COUNT(*)::int FROM society_join_requests j WHERE j.customer_id = c.id AND j.status = 'pending') AS pending_requests,
            (SELECT COUNT(*)::int FROM statements s WHERE s.customer_id = c.id AND s.stat_type = 'resolution') AS debate_count
     FROM customers c
     JOIN customer_roles cr ON cr.tenant_id = c.id AND cr.user_id = $1 AND cr.role = 'customer_admin'
     ORDER BY c.name`,
    [session.sub],
  );
  return NextResponse.json({ societies: rows, canCreate: session.tier === 'moderator' });
}

// POST { name, visibility, hero_text?, description? } — create a Society; the creator moderates it.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.tier !== 'moderator') {
    return NextResponse.json({ error: 'Creating a Society needs the Moderator plan' }, { status: 403 });
  }
  const { name, visibility, hero_text, description, slug: chosen } = await req.json().catch(() => ({}));
  if (typeof name !== 'string' || name.trim().length < 3) {
    return NextResponse.json({ error: 'Name must be at least 3 characters' }, { status: 400 });
  }
  const vis = VISIBILITIES.includes(visibility) ? visibility : 'public';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Its web address: the name the moderator chose, or one made from the Society's name
    let slug: string;
    if (typeof chosen === 'string' && chosen.trim()) {
      slug = chosen.trim().toLowerCase();
      const problem = slugProblem(slug);
      if (problem) { await client.query('ROLLBACK'); return NextResponse.json({ error: problem }, { status: 400 }); }
      if (!(await slugAvailable(slug))) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'That web address is already taken' }, { status: 409 }); }
    } else {
      const base = slugify(name);
      const { rows: taken } = await client.query(
        `SELECT subdomain FROM customers WHERE subdomain = $1 OR subdomain LIKE $1 || '-%'`, [base],
      );
      const used = new Set(taken.map(t => t.subdomain));
      slug = base;
      for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    }

    const { rows: [society] } = await client.query(
      `INSERT INTO customers (name, subdomain, status, visibility, hero_text, description, created_by)
       VALUES ($1, $2, 'active', $3, $4, $5, $6) RETURNING id`,
      [name.trim().slice(0, 120), slug, vis,
       typeof hero_text === 'string' && hero_text.trim() ? hero_text.trim().slice(0, 300) : null,
       typeof description === 'string' && description.trim() ? description.trim() : null,
       session.sub],
    );
    await client.query(`INSERT INTO customer_roles (tenant_id, user_id, role) VALUES ($1, $2, 'customer_admin')`, [society.id, session.sub]);
    await client.query(`INSERT INTO customer_members (customer_id, user_id) VALUES ($1, $2)`, [society.id, session.sub]);
    await client.query('COMMIT');
    return NextResponse.json({ id: society.id }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('create society failed:', err);
    return NextResponse.json({ error: 'Could not create the Society' }, { status: 500 });
  } finally {
    client.release();
  }
}
