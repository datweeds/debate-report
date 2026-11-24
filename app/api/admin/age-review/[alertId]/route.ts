import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest, forgetSessionsOf } from '@/lib/auth';
import { deleteAccount } from '@/lib/accountDelete';
import { closeAgeConcerns } from '@/lib/ageSignals';

type Params = { params: Promise<{ alertId: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

// PATCH { action } — the Sys Admin's decision on an age review:
//   adult     no concern: the age group stands, any hold is lifted
//   16-17     treat as 16 or 17 (every under-18 protection), any hold is lifted
//   close     under 16: the account is closed (anonymised, as if they deleted it)
// Until age checks exist this is a person's judgement; afterwards a check decides.
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { alertId } = await params;
  if (!UUID.test(alertId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { action } = await req.json().catch(() => ({}));
  if (!['adult', '16-17', 'close'].includes(action)) return NextResponse.json({ error: 'Choose a decision' }, { status: 400 });
  const { rows: [a] } = await pool.query(
    `SELECT id, author_id::text AS user_id FROM content_alerts WHERE id = $1 AND content_type = 'age_review'`, [alertId]);
  if (!a?.user_id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await closeAgeConcerns(a.user_id, action === 'close' ? 'closed' : action === '16-17' ? 'treated_16_17' : 'no_concern');
  if (action === 'close') {
    await deleteAccount(a.user_id);
    forgetSessionsOf(a.user_id);
  } else {
    const { rows: [u] } = await pool.query('SELECT age_band FROM users WHERE id = $1', [a.user_id]);
    if (action === '16-17' && u?.age_band !== '16-17') {
      await pool.query(`UPDATE users SET age_band = '16-17' WHERE id = $1`, [a.user_id]);
      await pool.query(`INSERT INTO age_band_changes (user_id, from_band, to_band, changed_by) VALUES ($1, $2, '16-17', 'sysadmin')`, [a.user_id, u?.age_band ?? null]);
    }
    await pool.query(
      `UPDATE users SET age_check_due = NULL,
              user_status = CASE WHEN age_hold_at IS NOT NULL AND user_status = 'suspended' THEN 'active' ELSE user_status END,
              age_hold_at = NULL WHERE id = $1`, [a.user_id]);
    forgetSessionsOf(a.user_id);   // re-read their status straight away
  }
  await pool.query(`UPDATE content_alerts SET status = 'passed', reviewed_by = $2, reviewed_at = now(),
                    flagged_text = flagged_text || $3 WHERE id = $1`,
    [alertId, session.sub, ` Decision: ${action === 'close' ? 'under 16, account closed' : action === '16-17' ? 'treated as 16 or 17' : 'no concern'}.`]);
  return NextResponse.json({ ok: true });
}
