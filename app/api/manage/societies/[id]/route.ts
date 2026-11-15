import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { moderatedSociety } from '@/lib/societies';

type Params = { params: Promise<{ id: string }> };

// GET — everything a moderator manages for one Society.
export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await moderatedSociety(req, params);
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [{ rows: [society] }, { rows: members }, { rows: requests }, { rows: invites }] = await Promise.all([
    pool.query(
      `SELECT id, name, visibility, hero_text, hero_image, description, contact_email, subdomain, is_default
       FROM customers WHERE id = $1`, [ctx.id]),
    pool.query(
      `SELECT m.user_id, m.joined_at, u.user_handle, u.user_full_name,
              EXISTS (SELECT 1 FROM customer_roles r WHERE r.tenant_id = m.customer_id AND r.user_id = m.user_id AND r.role = 'customer_admin') AS is_moderator
       FROM customer_members m LEFT JOIN users u ON u.id::text = m.user_id
       WHERE m.customer_id = $1 ORDER BY is_moderator DESC, u.user_handle`, [ctx.id]),
    pool.query(
      `SELECT j.id, j.user_id, j.message, j.created_at, u.user_handle, u.user_full_name
       FROM society_join_requests j LEFT JOIN users u ON u.id::text = j.user_id
       WHERE j.customer_id = $1 AND j.status = 'pending' ORDER BY j.created_at`, [ctx.id]),
    pool.query(
      `SELECT id, label, created_at, expires_at, revoked_at, use_count, last_used_at
       FROM society_invites WHERE customer_id = $1 ORDER BY created_at DESC`, [ctx.id]),
  ]);
  return NextResponse.json({ society, members, requests, invites, me: ctx.session.sub });
}

// PATCH { name?, visibility?, hero_text?, description? }
export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await moderatedSociety(req, params);
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const sets: string[] = [];
  const values: unknown[] = [];
  const set = (col: string, v: unknown) => { values.push(v); sets.push(`${col} = $${values.length}`); };

  if (typeof body.name === 'string') {
    if (body.name.trim().length < 3) return NextResponse.json({ error: 'Name must be at least 3 characters' }, { status: 400 });
    set('name', body.name.trim().slice(0, 120));
  }
  if (['public', 'apply', 'invite'].includes(body.visibility)) {
    set('visibility', body.visibility);
    // Only a public Society can be the site default
    if (body.visibility !== 'public') sets.push('is_default = false');
  }
  if (typeof body.hero_text === 'string') set('hero_text', body.hero_text.trim().slice(0, 300) || null);
  if (typeof body.description === 'string') set('description', body.description.trim() || null);
  if (typeof body.contact_email === 'string') {
    const e = body.contact_email.trim();
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return NextResponse.json({ error: 'Enter a valid contact email, or leave it blank' }, { status: 400 });
    set('contact_email', e || null);
  }
  if (!sets.length) return NextResponse.json({ ok: true });

  values.push(ctx.id);
  await pool.query(`UPDATE customers SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values);
  return NextResponse.json({ ok: true });
}
