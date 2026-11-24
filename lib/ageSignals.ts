// Age signals ("quiet estimation"): fixed, documented rules that decide who is
// asked to prove their age. They never block or downgrade anyone by themselves,
// except a member saying they're under 16, which puts the account on hold for a
// person to review. Only the rule's id and the date are kept, never the words.
// Described in the privacy notice and the DPIA. Review the rules every quarter.
// Server-only.
import pool from './db';
import { forgetSessionsOf } from './auth';

export const RULESET = 1;
export const THRESHOLD = 4;

type Rule = { id: string; points: number; test: (t: string) => boolean; action?: 'hold' | 'check' };

const NUM_UNDER_16 = String.raw`(?:1[0-5]|[5-9]|ten|eleven|twelve|thirteen|fourteen|fifteen)`;
const NUM_16_17 = String.raw`(?:1[67]|sixteen|seventeen)`;
// "I'm 14", "I am fifteen years old", "im 15 yo"; not "I'm 15 minutes late"
const iAm = (n: string) => new RegExp(String.raw`\b(?:i'?m|i am|im)\s+${n}\b(?!\s*(?:%|percent|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|miles?|km|kg|lbs?|stone|pounds?|quid|times|points|pages|feet|ft|inches|cm|mm|degrees|seconds?|secs?|people|of\b))`, 'i');
const SCHOOL = [
  // UK and Scotland
  String.raw`\b(?:i'?m|i am|im)\s+in\s+(?:year\s*(?:[7-9]|1[01])|s[1-4]|sixth form)\b`,
  String.raw`\bmy\s+(?:gcses?|nat(?:ional)?\s*5s?|mocks|sats)\b(?!\s*(?:class|classes|students|pupils|group|groups|set|sets|teaching|marking))`,
  String.raw`\b(?:doing|sitting|taking)\s+(?:my\s+)?(?:gcses?|nat(?:ional)?\s*5s?)\b`,
  String.raw`\bmy\s+(?:form tutor|head of year)\b`,
  // US and elsewhere
  String.raw`\b(?:i'?m|i am|im)\s+(?:in\s+)?(?:(?:6|7|8|9|10)th|sixth|seventh|eighth|ninth|tenth)\s+grade\b`,
  String.raw`\b(?:i'?m|i am|im)\s+a\s+(?:high school\s+)?(?:freshman|sophomore)\s+(?:in|at)\s+high school\b`,
  String.raw`\bmy\s+(?:middle school|high school)\s+(?:teacher|class)\b`,
].map(p => new RegExp(p, 'i'));
// About someone else (a parent, teacher or relative), so not about the writer
const SOMEONE_ELSE = /\bmy\s+(?:son|daughter|child|children|kids?|boy|girl|grand(?:son|daughter|child|kids?)|niece|nephew|brother|sister|pupils?|students?|class(?:es)?|year\s*\d+s?|form)\b|\b(?:our|the)\s+(?:pupils|students|class|year\s*\d+s?)\b|\bi\s+teach\b|\bi'?m\s+a\s+teacher\b/i;

export const RULES: Rule[] = [
  { id: 'stated-under-16', points: 0, action: 'hold', test: t => iAm(NUM_UNDER_16).test(t) },
  { id: 'stated-16-17', points: 0, action: 'check', test: t => iAm(NUM_16_17).test(t) },
  { id: 'school-stage', points: 2, test: t => SCHOOL.some(r => r.test(t)) },
];

const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;|’/g, "'").replace(/\s+/g, ' ');

/** The rules a piece of text fires, judged sentence by sentence (sentences about someone else are skipped). */
export function rulesFor(text: string): Rule[] {
  const all = plain(text);
  // A teacher or parent writing about school isn't talking about their own school year
  const aboutTeaching = /\bi\s+teach\b|\bi'?m\s+a\s+(?:teacher|parent|mum|mom|dad)\b|\bas\s+a\s+(?:teacher|parent)\b/i.test(all);
  const sentences = all.split(/(?<=[.!?\n])\s+/).filter(s => !SOMEONE_ELSE.test(s));
  return RULES.filter(r => !(aboutTeaching && r.id === 'school-stage') && sentences.some(s => r.test(s)));
}

/**
 * Run the rules on something a member wrote (called by the content scanner on
 * every new or changed text it can read). Fire-and-forget: errors are logged.
 */
export async function noteAgeSignals(o: { authorId: string | null; text: string; contentType: string; contentKey: string; societyId: number | null }) {
  if (!o.authorId || !o.text || o.text.startsWith('sn1:')) return;
  try {
    const fired = rulesFor(o.text);
    if (!fired.length) return;
    const { rows: [u] } = await pool.query('SELECT age_band, age_source, user_status FROM users WHERE id = $1', [o.authorId]);
    if (!u || u.user_status === 'closed') return;
    let added = false;
    for (const r of fired) {
      const { rowCount } = await pool.query(
        `INSERT INTO age_signals (user_id, rule_id, ruleset, points, content_type, content_key) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, rule_id, content_type, content_key) DO NOTHING`,
        [o.authorId, r.id, RULESET, r.points, o.contentType, o.contentKey]);
      if (rowCount) added = true;
    }
    if (!added) return;
    // A member already checked as 18+ isn't scored; saying they're under 16 is still looked at
    if (fired.some(r => r.action === 'hold')) return await holdForReview(o.authorId, 'stated-under-16', o.societyId, `${o.contentType} ${o.contentKey}`);
    if (u.age_source === 'checked') return;
    if (fired.some(r => r.action === 'check') && u.age_band === '18+') return await needsCheck(o.authorId, 'stated-16-17', o.societyId);
    await evaluate(o.authorId, o.societyId);
  } catch (err) {
    console.error('[age-signals]', err);
  }
}

/** The member's score: rules fired in the last year, band changes, and account age. */
export async function scoreOf(userId: string): Promise<{ score: number; rules: string[] }> {
  const { rows: [s] } = await pool.query(
    `SELECT COALESCE((SELECT sum(points) FROM age_signals WHERE user_id = $1 AND created_at > now() - interval '1 year'), 0)::int AS signals,
            (SELECT count(*) FROM age_band_changes WHERE user_id = $1 AND from_band IS NOT NULL AND changed_by = 'member')::int AS changes,
            (SELECT date_activated < now() - interval '3 years' AND age_band = '18+' FROM users WHERE id = $1) AS long_standing,
            ARRAY(SELECT DISTINCT rule_id FROM age_signals WHERE user_id = $1 AND created_at > now() - interval '1 year') AS rules`,
    [userId]);
  // Each change of age group: +2
  const score = s.signals + 2 * s.changes + (s.long_standing ? -2 : 0);
  return { score, rules: [...s.rules, ...(s.changes ? [`band-changed x${s.changes}`] : [])] };
}

/** Score the member and ask for review (later: an age check) at the threshold. */
export async function evaluate(userId: string, societyId: number | null) {
  const { rows: [u] } = await pool.query('SELECT age_band, age_source FROM users WHERE id = $1', [userId]);
  if (!u || u.age_source === 'checked' || u.age_band !== '18+') return;   // 16–17s already get every protection
  const { score } = await scoreOf(userId);
  if (score >= THRESHOLD) await needsCheck(userId, 'score', societyId);
}

/** An age check is needed. Until checks exist, a Sys Admin reviews it. */
export async function needsCheck(userId: string, why: string, societyId: number | null) {
  await pool.query('UPDATE users SET age_check_due = COALESCE(age_check_due, $2) WHERE id = $1', [userId, why]);
  await raiseReview(userId, why, societyId, false);
}

/** Possibly under 16: the account goes on hold until a Sys Admin reviews it. */
export async function holdForReview(userId: string, why: string, societyId: number | null, where?: string) {
  await pool.query(`UPDATE users SET age_hold_at = COALESCE(age_hold_at, now()), user_status = 'suspended' WHERE id = $1 AND user_status = 'active'`, [userId]);
  forgetSessionsOf(userId);
  await raiseReview(userId, why, societyId, true, where);
}

/**
 * Someone raised an age concern about a member (a "May be under 16" report, or a
 * Society Admin's concern). Logged for the Society's Admins to follow; reviewed
 * by the new.vote team in the age review queue.
 */
export async function raiseAgeConcern(o: { userId: string; societyId: number | null; raisedBy: string | null;
  raisedAs: 'society_admin' | 'member' | 'visitor'; note: string | null; itemKind: string | null }) {
  const { sealText } = await import('./societyCrypto');
  const note = o.note ? (o.societyId != null ? await sealText(o.societyId, o.note, true) : o.note) : null;
  await pool.query(
    `INSERT INTO age_concerns (user_id, customer_id, raised_by, raised_as, note, item_kind) VALUES ($1, $2, $3, $4, $5, $6)`,
    [o.userId, o.societyId, o.raisedBy, o.raisedAs, note, o.itemKind]);
  const who = o.raisedAs === 'society_admin' ? 'a Society Admin' : o.raisedAs === 'member' ? 'a member' : 'a visitor';
  await pool.query('UPDATE users SET age_check_due = COALESCE(age_check_due, $2) WHERE id = $1', [o.userId, 'reported']);
  await raiseReview(o.userId, 'reported', o.societyId, false, `a concern from ${who}${o.itemKind ? ` (about their ${o.itemKind})` : ''}; see the Society's age concerns for the note`);
}

/** Every open concern about a member gets this outcome. */
export async function closeAgeConcerns(userId: string, status: string) {
  await pool.query(`UPDATE age_concerns SET status = $2, decided_at = now() WHERE user_id = $1 AND status = 'pending'`, [userId, status]);
}

// One open age review per member, in the new.vote team's queue (never the Society's)
async function raiseReview(userId: string, why: string, societyId: number | null, urgent: boolean, where?: string) {
  const { rows: open } = await pool.query(
    `SELECT id, urgent FROM content_alerts WHERE content_type = 'age_review' AND author_id = $1 AND status = 'pending'`, [userId]);
  const { score, rules } = await scoreOf(userId);
  const text = `Age review (${why}): score ${score}; rules fired: ${rules.join(', ') || 'none'}${where ? `; seen in ${where}` : ''}. ` +
    (urgent ? 'The member may be under 16: the account is on hold.' : 'An age check is due (until checks exist: review and decide).');
  if (open.length) {
    await pool.query('UPDATE content_alerts SET flagged_text = $2, urgent = urgent OR $3 WHERE id = $1', [open[0].id, text, urgent]);
    return;
  }
  await pool.query(
    `INSERT INTO content_alerts (content_type, content_key, customer_id, flagged_text, flags, author_id, report_route, urgent, involves_minor)
     VALUES ('age_review', $1, $2, $3, $4::text[], $5, 'platform', $6, true)`,
    [`age:${userId}:${Date.now()}`, societyId, text, [why], userId, urgent]);
}
