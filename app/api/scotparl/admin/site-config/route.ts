import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { isCustomerAdmin } from '@/lib/roles';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const canAdmin = session.isSysAdmin || await isCustomerAdmin(session.sub, TENANT_ID);
  if (!canAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { rows: [c] } = await pool.query(
    `SELECT name, hero_text, hero_image, contact_email FROM customers WHERE id = $1`,
    [TENANT_ID]
  );
  return NextResponse.json(c ?? {});
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const canAdmin = session.isSysAdmin || await isCustomerAdmin(session.sub, TENANT_ID);
  if (!canAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, hero_text, hero_image, contact_email } = await req.json();

  await pool.query(
    `UPDATE customers
     SET name                 = COALESCE($1, name),
         hero_text            = COALESCE($2, hero_text),
         hero_image           = COALESCE($3, hero_image),
         contact_email        = COALESCE($4, contact_email),
         updated_at           = now()
     WHERE id = $5`,
    [
      name?.trim()          || null,
      hero_text?.trim()     || null,
      hero_image?.trim()    || null,
      contact_email?.trim() || null,
      TENANT_ID,
    ]
  );
  return NextResponse.json({ ok: true });
}
