import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, hero_text, hero_image, contact_email, platform_contact_email, status, is_public, visibility, description } = body;

  const allowed_statuses = ['active', 'paused', 'closed'];
  if (status && !allowed_statuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // is_public is boolean — COALESCE-against-null (the pattern the other fields
  // use) can't distinguish "set to false" from "not provided", so it's built
  // into the dynamic field list only when actually present in the body.
  const fields: string[] = [
    'name = COALESCE($1, name)',
    'hero_text = COALESCE($2, hero_text)',
    'hero_image = COALESCE($3, hero_image)',
    'contact_email = COALESCE($4, contact_email)',
    'platform_contact_email = COALESCE($5, platform_contact_email)',
    'status = COALESCE($6, status)',
    'updated_at = now()',
  ];
  const values: unknown[] = [
    name?.trim() || null,
    hero_text?.trim() || null,
    hero_image?.trim() || null,
    contact_email?.trim() || null,
    platform_contact_email?.trim() || null,
    status || null,
  ];

  // visibility: 'public' | 'apply' | 'invite' (is_public is derived from it).
  // The older boolean is still accepted: false means invite-only.
  const vis = ['public', 'apply', 'invite'].includes(visibility) ? visibility
    : typeof is_public === 'boolean' ? (is_public ? 'public' : 'invite') : null;
  if (vis === 'public') {
    const { sealedSection } = await import('@/lib/sealed/server');
    const { rows: [cur] } = await pool.query('SELECT visibility FROM customers WHERE id = $1', [Number(id)]);
    if (cur?.visibility !== 'public' && await sealedSection(Number(id), 'debates')) {
      return NextResponse.json({ error: 'This Society’s debates are sealed: its moderators must unseal them before it can be made public' }, { status: 409 });
    }
  }
  if (vis) {
    values.push(vis);
    fields.push(`visibility = $${values.length}`);
    // A society that's no longer public can't stay the default — logged-out
    // visitors couldn't see it. Demote it from default in the same update.
    if (vis !== 'public') fields.push('is_default = false');
  }

  // The long-form description can be cleared, so (like is_public) it's set
  // whenever the body carries it — an empty string stores NULL.
  if (typeof description === 'string') {
    values.push(description.trim() || null);
    fields.push(`description = $${values.length}`);
  }

  values.push(id);
  await pool.query(`UPDATE customers SET ${fields.join(', ')} WHERE id = $${values.length}`, values);

  return NextResponse.json({ ok: true });
}
