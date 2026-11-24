// Age checks: recording a result, and the rules for when one is needed. A check
// result overrides the declared age. Only the band, the method and the date are
// kept. Server-only.
import pool from '../db';
import { forgetSessionsOf } from '../auth';
import { closeAgeConcerns, holdForReview } from '../ageSignals';
import { ageCheckSettings } from './settings';

export type CheckMethod = 'wallet' | 'face' | 'id_document' | 'sysadmin';

/** Record a passed (or failed) check. Under 16: the account goes on hold for review. */
export async function recordCheck(userId: string, r: { over16: boolean; over18: boolean; method: CheckMethod }) {
  const { rows: [u] } = await pool.query('SELECT age_band FROM users WHERE id = $1', [userId]);
  if (!r.over16) {
    await holdForReview(userId, `check-under-16 (${r.method})`, null);
    return { band: null, held: true };
  }
  const band = r.over18 ? '18+' : '16-17';
  await closeAgeConcerns(userId, r.over18 ? 'checked_adult' : 'checked_16_17');
  await pool.query(
    `UPDATE users SET age_band = $2, age_source = 'checked', age_check_method = $3, age_checked_at = now(), age_check_due = NULL WHERE id = $1`,
    [userId, band, r.method]);
  if (u?.age_band !== band) {
    await pool.query(`INSERT INTO age_band_changes (user_id, from_band, to_band, changed_by) VALUES ($1, $2, $3, 'check')`, [userId, u?.age_band ?? null, band]);
  }
  // Any open age review is answered by the check
  await pool.query(
    `UPDATE content_alerts SET status = 'passed', reviewed_at = now(), flagged_text = flagged_text || $2
     WHERE content_type = 'age_review' AND author_id = $1 AND status = 'pending' AND NOT urgent`,
    [userId, ` Answered by an age check (${r.method}): ${band}.`]);
  forgetSessionsOf(userId);
  return { band, held: false };
}

/** Why this member can't join a Society that has an Area, or null if they can. */
export async function areaJoinProblem(userId: string, societyId: number): Promise<string | null> {
  const { rows: [c] } = await pool.query('SELECT area_id FROM customers WHERE id = $1', [societyId]);
  if (!c?.area_id) return null;   // not local: no check needed
  const { rows: [u] } = await pool.query('SELECT age_band, age_source FROM users WHERE id = $1', [userId]);
  if (u?.age_band !== '18+') return 'This Society is for people aged 18 and over.';
  const s = await ageCheckSettings();
  if (s.enabled && u.age_source !== 'checked') return 'CHECK';   // the caller sends the member to /age-check
  return null;
}
