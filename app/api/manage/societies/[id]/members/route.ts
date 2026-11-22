import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { moderatedSociety } from '@/lib/societies';

type Params = { params: Promise<{ id: string }> };

// PATCH { userId, action: 'remove' | 'make_moderator' | 'remove_moderator' | 'make_owner' }
// The owner's plan covers the Society; only the owner (or Sys Admin) can hand it to another Society Admin.
export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await moderatedSociety(req, params);
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { userId, action } = await req.json().catch(() => ({}));
  if (typeof userId !== 'string') return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  const { rows: mods } = await pool.query(
    `SELECT user_id FROM customer_roles WHERE tenant_id = $1 AND role = 'customer_admin'`, [ctx.id],
  );
  const isMod = mods.some(m => m.user_id === userId);
  const { rows: [own] } = await pool.query('SELECT owner_id::text AS owner FROM customers WHERE id = $1', [ctx.id]);
  const isOwner = own?.owner === userId;
  const lastModerator = isMod && mods.length === 1;

  if (action === 'make_moderator') {
    const { rows } = await pool.query('SELECT 1 FROM customer_members WHERE customer_id = $1 AND user_id = $2', [ctx.id, userId]);
    if (!rows.length) return NextResponse.json({ error: 'Only members can be made Society Admins' }, { status: 400 });
    await pool.query(
      `INSERT INTO customer_roles (tenant_id, user_id, role) VALUES ($1, $2, 'customer_admin')
       ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = 'customer_admin'`, [ctx.id, userId]);
  } else if (action === 'make_owner') {
    if (own?.owner !== ctx.session.sub && !ctx.session.isSysAdmin) return NextResponse.json({ error: 'Only the Society’s owner can hand it on' }, { status: 403 });
    if (!isMod) return NextResponse.json({ error: 'Make them a Society Admin first' }, { status: 400 });
    await pool.query('UPDATE customers SET owner_id = $2::uuid WHERE id = $1', [ctx.id, userId]);
  } else if (action === 'remove_moderator' || action === 'remove') {
    if (isOwner) return NextResponse.json({ error: 'This is the Society’s owner: hand ownership to another Society Admin first' }, { status: 400 });
    if (lastModerator) return NextResponse.json({ error: 'A Society needs at least one Society Admin' }, { status: 400 });
    await pool.query(`DELETE FROM customer_roles WHERE tenant_id = $1 AND user_id = $2`, [ctx.id, userId]);
    if (action === 'remove') {
      await pool.query('DELETE FROM customer_members WHERE customer_id = $1 AND user_id = $2', [ctx.id, userId]);
    }
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
