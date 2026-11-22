// Formal ballot tests, against the running app (localhost:3004): the voter
// roll, quorum and majority, scrutineers, certification and its timestamp.
// Creates its own VERIFY-* Society and users, and removes them at the end.
// Certifying asks freetsa.org for a timestamp (only a hash is sent).
//
//   cd ~/debate-report && node scripts/poll-formal.mjs

import crypto from 'crypto';
import fs from 'fs';
import pg from 'pg';
import { SignJWT } from 'jose';

const env = ['.env.local', '.env.production.local', '.env'].filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');
const get = k => [...env.matchAll(new RegExp('^' + k + '=["\']?([^"\'\\n]+)', 'mg'))].map(m => m[1]).at(-1);
const pool = new pg.Pool({ connectionString: get('DATABASE_URL') });
const B = process.env.BASE_URL ?? 'http://localhost:3004';
const U = {};
let failures = 0;
const ok = (label, cond, detail = '') => { if (!cond) failures++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail !== '' ? `  (${detail})` : ''}`); };

async function user(n, tier = 'debater') {
  const { rows: [u] } = await pool.query(
    `INSERT INTO users (user_handle, user_tier, user_plan, access_code, is_sys_admin) VALUES ($1, $2, 'free', 'x-' || $1, false) RETURNING id`,
    [`VERIFY-${n}-TEST`, tier]);
  U[n] = { id: u.id, tok: await new SignJWT({ sub: u.id, handle: `VERIFY-${n}-TEST`, isSysAdmin: false, isScotparlMod: false, tier, plan: 'free', customerAdminTenants: [], topicOwnerTenants: [] })
    .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode(get('JWT_SECRET'))) };
}
const raw = (who, method, path, body) => fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(who ? { Cookie: 'dr_session=' + U[who].tok } : {}) }, body: body && JSON.stringify(body) });
const call = async (who, method, path, body) => { const r = await raw(who, method, path, body); let j = null; try { j = await r.json(); } catch { /* not JSON */ } return [r.status, j]; };
const receipt = () => crypto.createHash('sha256').update(crypto.randomBytes(16)).digest('hex');

const payload = {
  title: 'VERIFY AGM ballot',
  questions: [
    { id: 'm1', text: 'Motion 1: adopt the new constitution', type: 'yes_no', options: [], settings: {} },
    { id: 'm2', text: 'Motion 2: raise the subscription', type: 'yes_no', options: [], settings: {} },
    { id: 'c1', text: 'Chair', type: 'single_choice', options: [{ id: 'A', text: 'Ann' }, { id: 'B', text: 'Bob' }], settings: {} },
  ],
};
const vote = (m1, m2, c1) => [{ questionId: 'm1', value: m1 }, { questionId: 'm2', value: m2 }, { questionId: 'c1', value: c1 }];

let soc;
try {
  for (const n of ['chair', 'm1', 'm2', 'm3', 'm4', 'scrut', 'late']) await user(n, n === 'chair' ? 'moderator' : 'debater');
  soc = (await pool.query(`INSERT INTO customers (name, subdomain, status, visibility) VALUES ('VERIFY Formal Soc', 'verify-formal-soc', 'active', 'apply') RETURNING id`)).rows[0].id;
  await pool.query(`INSERT INTO customer_roles (tenant_id, user_id, role) VALUES ($1, $2, 'customer_admin')`, [soc, U.chair.id]);
  for (const n of ['m1', 'm2', 'm3', 'm4', 'scrut']) await pool.query('INSERT INTO customer_members (customer_id, user_id) VALUES ($1, $2)', [soc, U[n].id]);
  const S = `/api/societies/${soc}/polls`;

  // ── Set up
  let [s, j] = await call('chair', 'POST', S, { payload, formal: true, quorum_pct: 50, majority: 'two_thirds', allow_codes: true, is_quiz: true });
  ok('a formal ballot can’t be a quiz', s === 400, j?.error);
  [s, j] = await call('chair', 'POST', S, { payload, formal: true, quorum_pct: 150 });
  ok('a quorum over 100% is refused', s === 400, j?.error);
  [s, j] = await call('chair', 'POST', S, { payload, formal: true, quorum_pct: 50, majority: 'two_thirds', allow_codes: true, result_visibility: 'after_close' });
  const pid = j.id, P = `${S}/${pid}`;
  ok('moderator creates a formal ballot', s === 201 && !!pid, s);
  [s, j] = await call('chair', 'POST', `${P}/codes`, { labels: ['Postal voter'] });
  const code = j.codes?.[0]?.code;
  ok('a code made before opening', s === 201 && !!code, s);
  [s, j] = await call('chair', 'POST', `${P}/scrutineers`, { handle: 'VERIFY-scrut-TEST' });
  ok('a member is appointed scrutineer', s === 201 && j.scrutineers.length === 1, s);
  [s, j] = await call('chair', 'POST', `${P}/scrutineers`, { handle: 'nobody-here' });
  ok('a non-member can’t be scrutineer', s === 404, s);

  // ── Open: the roll is fixed
  [s] = await call('chair', 'PATCH', P, { action: 'open' }); ok('opens', s === 200, s);
  const { rows: roll } = await pool.query('SELECT voter_key FROM poll_roll WHERE poll_id = $1', [pid]);
  ok('roll = 6 members (chair, 4 members, scrutineer) + 1 code', roll.length === 7, roll.length);
  [s, j] = await call('chair', 'POST', `${P}/codes`, { labels: ['Too late'] });
  ok('no new codes once voting is open', s === 409, j?.error);
  [s, j] = await call('chair', 'PATCH', P, { formal: false });
  [, j] = await call('chair', 'GET', P);
  ok('formal can’t be switched off once open', j.poll.formal === true, '');
  await pool.query('INSERT INTO customer_members (customer_id, user_id) VALUES ($1, $2)', [soc, U.late.id]);
  [s, j] = await call('late', 'POST', `${P}/vote`, { answers: vote('yes', 'yes', 'A'), receiptHash: receipt() });
  ok('a member who joined after opening can’t vote', s === 403, j?.error);

  // ── Votes: m1 yes/yes/A, m2 yes/no/A, m3 yes/no/B, m4 no/no/A, code yes/yes/B → motion 1: 4 yes / 1 no = 80% (carried, ≥ 2/3); motion 2: 2/5 (not carried); chair: Ann 3, Bob 2
  for (const [n, v] of [['m1', vote('yes', 'yes', 'A')], ['m2', vote('yes', 'no', 'A')], ['m3', vote('yes', 'no', 'B')], ['m4', vote('no', 'no', 'A')]]) {
    [s, j] = await call(n, 'POST', `${P}/vote`, { answers: v, receiptHash: receipt() });
    if (s !== 201) ok(`${n} votes`, false, `${s} ${j?.error}`);
  }
  [s, j] = await call(null, 'POST', `/api/polls/${pid}/vote`, { code, answers: vote('yes', 'yes', 'B'), receiptHash: receipt() });
  ok('the postal code votes', s === 201, `${s} ${j?.error ?? ''}`);

  // ── Scrutineer: oversees, can't run it
  [s, j] = await call('scrut', 'GET', `${P}/participants`); ok('scrutineer sees who has voted', s === 200 && j.voted.length === 5, s);
  [s] = await call('m1', 'GET', `${P}/participants`); ok('an ordinary member can’t', s === 403, s);
  [s, j] = await call('scrut', 'GET', `${P}/verify`); ok('scrutineer can verify the count', s === 200 && j.ok, s);
  [s] = await call('scrut', 'PATCH', P, { action: 'close' }); ok('scrutineer can’t close it', s === 403, s);
  [, j] = await call('scrut', 'GET', P); ok('scrutineer doesn’t see the result before it closes', j.results === null && j.scrutineer === true, '');
  [s, j] = await call('chair', 'PATCH', P, { action: 'certify' }); ok('can’t certify while open', s === 409, j?.error);

  // ── Close: outcome
  [s] = await call('chair', 'PATCH', P, { action: 'close' }); ok('closes', s === 200, s);
  [, j] = await call('scrut', 'GET', P);
  const o = j.formal?.outcome;
  ok('turnout 5 of 7 (71.4%), quorum 50% met', o?.turnout.voted === 5 && o.turnout.roll === 7 && o.turnout.pct === 71.4 && o.quorum.met === true, JSON.stringify(o?.turnout));
  ok('motion 1 carried (80% ≥ two-thirds)', o?.questions[0].outcome === 'carried', o?.questions[0].detail);
  ok('motion 2 not carried (40%)', o?.questions[1].outcome === 'not_carried', o?.questions[1].detail);
  ok('Ann elected chair (3 to 2)', o?.questions[2].outcome === 'elected' && o.questions[2].detail.startsWith('Ann'), o?.questions[2].detail);

  // ── Certify
  [s] = await call('m1', 'PATCH', P, { action: 'certify' }); ok('a member can’t certify', s === 403, s);
  [s, j] = await call('chair', 'PATCH', P, { action: 'certify' }); ok('chair certifies', s === 200, j?.error ?? '');
  ok('…with an independent timestamp', j?.timestamped === true, j?.timestamped);
  [s, j] = await call('chair', 'PATCH', P, { action: 'certify' }); ok('certifying twice is refused', s === 409, s);
  [s, j] = await call('chair', 'PATCH', P, { action: 'reopen' }); ok('a certified ballot can’t be reopened', s === 409, j?.error);
  [s, j] = await call('chair', 'POST', `${P}/scrutineers`, { handle: 'VERIFY-m1-TEST' }); ok('scrutineers are fixed after certifying', s === 409, s);
  [s, j] = await call('m2', 'GET', `${P}/certificate`);
  ok('members can read the certificate', s === 200 && !!j.digest, s);
  const doc = await (await raw('m2', 'GET', `${P}/certificate?file=json`)).text();
  ok('the document’s SHA-256 is the certified digest', crypto.createHash('sha256').update(doc).digest('hex') === j.digest, '');
  const d = JSON.parse(doc);
  ok('the document records roll, turnout, outcomes and scrutineers',
    d.voter_roll.total === 7 && d.turnout.voted === 5 && d.outcomes[0].outcome === 'carried' && d.scrutineers[0] === '@VERIFY-scrut-TEST', '');
  const tsr = Buffer.from(await (await raw('m2', 'GET', `${P}/certificate?file=tsr`)).arrayBuffer());
  ok('the timestamp covers that digest', tsr.length > 100 && tsr.includes(Buffer.from(j.digest, 'hex')), tsr.length);
  fs.writeFileSync('/tmp/formal-test.json', doc); fs.writeFileSync('/tmp/formal-test.tsr', tsr);
  const { rows: [stored] } = await pool.query('SELECT document FROM poll_certificates WHERE poll_id = $1', [pid]);
  ok('certificate stored encrypted (private Society)', stored.document.startsWith(`enc2:${soc}:`), stored.document.slice(0, 12));
  [s] = await call(null, 'GET', `${P}/certificate`); ok('not readable without access', s === 404 || s === 403, s);
} catch (err) {
  failures++;
  console.log('FAIL  the test itself crashed:', err?.stack ?? err);
} finally {
  const ids = Object.values(U).map(u => u.id);
  await pool.query('DELETE FROM customer_roles WHERE user_id = ANY($1::text[]) OR tenant_id = $2', [ids, soc ?? -1]);
  await pool.query('DELETE FROM customer_members WHERE user_id = ANY($1::text[]) OR customer_id = $2', [ids, soc ?? -1]);
  if (soc) await pool.query('DELETE FROM customers WHERE id = $1', [soc]);          // polls, roll, certificate cascade
  await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids]);
  await pool.end();
  console.log(failures ? `\n${failures} FAILED` : '\nAll formal ballot tests passed');
  process.exitCode = failures ? 1 : 0;
}
