// Shared loader for /society/[id]/* pages: the Society plus the viewer's
// access. Non-members of an Apply Society go to its teaser; Invite Societies
// don't exist for them. Server-only.

import { notFound, redirect } from 'next/navigation';
import pool from './db';
import { getSession } from './auth';
import { getSocietyAccess } from './societies';

export async function loadSocietyPage(rawId: string) {
  const id = parseInt(rawId, 10);
  if (isNaN(id)) notFound();
  const session = await getSession().catch(() => null);
  const access = await getSocietyAccess(session, id);
  if (!access || !access.canSeeTeaser) notFound();
  if (!access.canEnter) redirect(`/scotparl?society=${id}`);
  const { rows: [society] } = await pool.query(
    'SELECT id, name, hero_text, hero_image, visibility FROM customers WHERE id = $1', [id],
  );
  if (!society) notFound();
  return { society, access, session };
}
