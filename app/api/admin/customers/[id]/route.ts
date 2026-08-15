import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, hero_text, hero_image, contact_email, platform_contact_email, status } = body;

  const allowed_statuses = ['active', 'paused', 'closed'];
  if (status && !allowed_statuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  await pool.query(
    `UPDATE customers
     SET name = COALESCE($1, name),
         hero_text = COALESCE($2, hero_text),
         hero_image = COALESCE($3, hero_image),
         contact_email = COALESCE($4, contact_email),
         platform_contact_email = COALESCE($5, platform_contact_email),
         status = COALESCE($6, status),
         updated_at = now()
     WHERE id = $7`,
    [
      name?.trim() || null,
      hero_text?.trim() || null,
      hero_image?.trim() || null,
      contact_email?.trim() || null,
      platform_contact_email?.trim() || null,
      status || null,
      id,
    ]
  );

  return NextResponse.json({ ok: true });
}
