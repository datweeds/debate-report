import { NextRequest, NextResponse } from 'next/server';
import { createToken, sessionCookie } from '@/lib/auth';
import { PLANS, enforcementOn, nextPlan, personPlan, planRefusal } from '@/lib/plans';
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
  return NextResponse.json({ societies: rows, canCreate: true });
}

// POST { name, visibility, hero_text?, description? } — create a Society; the creator moderates it.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  // Anyone signed in can start a Society (no approval). While plan limits are
  // enforced, their plan says how many they can run (Huddle 3, Team 10, Network 25).
  if (!session.isSysAdmin && await enforcementOn()) {
    const plan = (await personPlan(session.sub)).plan;
    const cap = PLANS[plan].limits.societies;
    const { rows: [n] } = await pool.query(`SELECT count(*)::int AS n FROM customers WHERE owner_id = $1 AND status = 'active' AND held_at IS NULL`, [session.sub]);
    if (n.n >= cap) {
      const up = nextPlan(plan);
      return planRefusal(`You run ${n.n} Societies, the most ${PLANS[plan].name} covers.${up ? ` Move to ${PLANS[up].name} to run up to ${PLANS[up].limits.societies}` : ' Close one'}, or close one you no longer need.`);
    }
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
      `INSERT INTO customers (name, subdomain, status, visibility, hero_text, description, created_by, owner_id)
       VALUES ($1, $2, 'active', $3, $4, $5, $6, $7) RETURNING id`,
      [name.trim().slice(0, 120), slug, vis,
       typeof hero_text === 'string' && hero_text.trim() ? hero_text.trim().slice(0, 300) : null,
       typeof description === 'string' && description.trim() ? description.trim() : null,
       session.sub, session.sub],
    );
    await client.query(`INSERT INTO customer_roles (tenant_id, user_id, role) VALUES ($1, $2, 'customer_admin')`, [society.id, session.sub]);
    await client.query(`INSERT INTO customer_members (customer_id, user_id) VALUES ($1, $2)`, [society.id, session.sub]);
    await client.query('COMMIT');
    // The creator is now a Society Admin: their session gets the tools at once
    await pool.query(`UPDATE users SET user_tier = 'moderator' WHERE id = $1 AND user_tier IS DISTINCT FROM 'moderator'`, [session.sub]);
    const res = NextResponse.json({ id: society.id }, { status: 201 });
    res.cookies.set(sessionCookie(await createToken({ ...session, tier: 'moderator', customerAdminTenants: [...(session.customerAdminTenants ?? []), society.id] })));
    return res;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('create society failed:', err);
    return NextResponse.json({ error: 'Could not create the Society' }, { status: 500 });
  } finally {
    client.release();
  }
}
