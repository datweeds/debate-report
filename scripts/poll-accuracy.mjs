// Poll accuracy and security tests, against the running app (localhost:3004).
// Casts a known set of ballots through the real API and checks every count
// against answers worked out by hand. Creates its own VERIFY-* Society and
// users, and removes them at the end.
//
//   cd ~/debate-report && node scripts/poll-accuracy.mjs

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
const sortKeys = v => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sortKeys(x)])) : Array.isArray(v) ? v.map(sortKeys) : v;
const eq = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));

async function user(n, tier = 'debater') {
  const { rows: [u] } = await pool.query(
    `INSERT INTO users (user_handle, user_tier, user_plan, access_code, is_sys_admin) VALUES ($1, $2, 'free', 'x-' || $1, false) RETURNING id`,
    [`VERIFY-${n}-TEST`, tier]);
  U[n] = { id: u.id, tok: await new SignJWT({ sub: u.id, handle: `VERIFY-${n}-TEST`, isSysAdmin: false, isScotparlMod: false, tier, plan: 'free', customerAdminTenants: [], topicOwnerTenants: [] })
    .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode(get('JWT_SECRET'))) };
}
const call = async (who, method, path, body) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(who ? { Cookie: 'dr_session=' + U[who].tok } : {}) }, body: body && JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch { /* not JSON */ }
  return [r.status, j];
};
const receipt = () => { const s = crypto.randomBytes(16); return { secret: s.toString('hex'), hash: crypto.createHash('sha256').update(s).digest('hex') }; };

// ── The poll: every question type ───────────────────────────────────────────
const opt = (...ids) => ids.map(id => ({ id, text: `Option ${id}` }));
const payload = {
  title: 'VERIFY accuracy poll',
  questions: [
    { id: 'q1', text: 'Single', type: 'single_choice', options: opt('A', 'B', 'C'), correct: ['A'], settings: { allowComments: true, commentsPublic: true } },
    { id: 'q2', text: 'Multi', type: 'multi_choice', options: opt('X', 'Y', 'Z'), settings: { maxChoices: 2 } },
    { id: 'q3', text: 'Ranked', type: 'ranked', options: opt('P', 'Q', 'R'), settings: {} },
    { id: 'q4', text: 'RCV', type: 'rcv', options: opt('A', 'B', 'C', 'D'), settings: {} },
    { id: 'q5', text: 'Star', type: 'star', options: opt('S1', 'S2'), settings: {} },
    { id: 'q6', text: 'Yes/no', type: 'yes_no', options: [], correct: ['yes'], settings: {} },
    { id: 'q7', text: 'Scale', type: 'scale', options: [], settings: { scaleMin: 1, scaleMax: 5 } },
    { id: 'q8', text: 'Word', type: 'word', options: [], settings: {} },
  ],
};
// The final ballot of each of 8 voters (6 members, 2 access codes)
const ballots = [
  ['A', ['X', 'Y'], ['P', 'Q', 'R'], ['A', 'B'], { S1: 5, S2: 1 }, 'yes', 5, 'blue'],
  ['A', ['X'],      ['P', 'R', 'Q'], ['A', 'C'], { S1: 4, S2: 2 }, 'yes', 4, 'Blue '],
  ['B', ['Y', 'Z'], ['Q', 'P', 'R'], ['A'],      { S1: 3, S2: 3 }, 'no',  3, 'red'],
  ['C', ['X', 'Z'], ['R', 'P', 'Q'], ['B', 'C'], { S1: 5, S2: 4 }, 'yes', 5, 'green'],
  ['A', ['Z'],      ['P', 'Q', 'R'], ['B', 'C'], { S1: 2, S2: 5 }, 'no',  2, 'blue'],
  ['B', ['X'],      ['Q', 'R', 'P'], ['C', 'B'], { S1: 4, S2: 4 }, 'yes', 4, 'red'],
  ['A', ['X', 'Z'], ['P', 'Q', 'R'], ['D', 'C'], { S1: 1, S2: 2 }, 'no',  1, 'blue'],
  ['C', ['Y'],      ['R', 'Q', 'P'], ['D', 'B'], { S1: 3, S2: 5 }, 'yes', 3, 'gold'],
].map(v => v.map((value, i) => ({ questionId: `q${i + 1}`, value, ...(i === 0 ? { comment: `comment ${v[7]}` } : {}) })));
// Worked out by hand
const expected = {
  q1: { A: 4, B: 2, C: 2 },
  q2: { X: 5, Y: 3, Z: 4 },
  q3: { first: { P: 4, Q: 2, R: 2 }, avg: {} },
  q4: { rounds: [{ A: 3, B: 2, C: 1, D: 2 }, { A: 3, B: 3, D: 2 }, { A: 3, B: 4 }], eliminated: [['C'], ['D'], []], exhausted: [0, 0, 1], winner: 'Option B' },
  q5: { S1: 3.4, S2: 3.3 },
  q6: { yes: 5, no: 3 },
  q7: { average: 3.4, min: 1, max: 5, distribution: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2 } },
  q8: [{ word: 'blue', count: 4 }, { word: 'red', count: 2 }, { word: 'gold', count: 1 }, { word: 'green', count: 1 }],
};
// Average ranks, from the rankings above: P 1,1,2,2,1,3,1,3 = 14/8 = 1.75 → 1.8; Q 2,3,1,3,2,1,2,2 = 16/8 = 2;
// R 3,2,3,1,3,2,3,1 = 18/8 = 2.25 → 2.3
expected.q3.avg = { P: 1.8, Q: 2, R: 2.3 };
// Stars: S1 5+4+3+5+2+4+1+3 = 27/8 = 3.375 → 3.4; S2 1+2+3+4+5+4+2+5 = 26/8 = 3.25 → 3.3
// Scale: 5+4+3+5+2+4+1+3 = 27/8 = 3.375 → 3.4

let soc;
try {
  for (const n of ['pmod', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'outsider']) await user(n, n === 'pmod' ? 'moderator' : 'debater');
  soc = (await pool.query(`INSERT INTO customers (name, subdomain, status, visibility) VALUES ('VERIFY Poll Soc', 'verify-poll-soc', 'active', 'apply') RETURNING id`)).rows[0].id;
  await pool.query(`INSERT INTO customer_roles (tenant_id, user_id, role) VALUES ($1, $2, 'customer_admin')`, [soc, U.pmod.id]);
  for (const n of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']) await pool.query('INSERT INTO customer_members (customer_id, user_id) VALUES ($1, $2)', [soc, U[n].id]);
  const S = `/api/societies/${soc}/polls`;

  // ── Create and open
  let [s, j] = await call('v1', 'POST', S, { payload });
  ok('members cannot create polls', s === 403, s);
  [s, j] = await call('pmod', 'POST', S, { payload, result_visibility: 'live', ballot_mode: 'secret', allow_revote: true, is_quiz: true, allow_codes: true });
  const pid = j.id; const P = `${S}/${pid}`;
  ok('moderator creates a draft', s === 201 && !!pid, s);
  [s] = await call('v1', 'GET', P); ok('members cannot see a draft', s === 404, s);
  const row = await pool.query('SELECT payload FROM society_polls WHERE id = $1', [pid]);
  ok('poll questions stored encrypted (private Society)', row.rows[0].payload.startsWith(`enc2:${soc}:`));
  [s] = await call('v1', 'POST', `${P}/vote`, { answers: ballots[0], receiptHash: receipt().hash }); ok('no voting in a draft', s === 404 || s === 409, s);
  [s] = await call('pmod', 'PATCH', P, { action: 'open' }); ok('opens', s === 200, s);
  [s, j] = await call('pmod', 'POST', `${P}/codes`, { labels: ['Guest one', 'Guest two'] });
  const codes = j.codes.map(c => c.code);
  ok('two access codes made', s === 201 && codes.length === 2 && /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(codes[0]), codes[0]);

  // ── Validation and security
  [s, j] = await call('v1', 'GET', P);
  ok('voters do not see quiz answers while open', j.poll.payload.questions.every(q => !q.correct), '');
  const bad = structuredClone(ballots[0]); bad[0].value = 'NOPE';
  [s, j] = await call('v1', 'POST', `${P}/vote`, { answers: bad, receiptHash: receipt().hash }); ok('an unknown option is refused', s === 400, j?.error);
  const tooMany = structuredClone(ballots[0]); tooMany[1].value = ['X', 'Y', 'Z'];
  [s, j] = await call('v1', 'POST', `${P}/vote`, { answers: tooMany, receiptHash: receipt().hash }); ok('more than the allowed choices is refused', s === 400, j?.error);
  const partialRank = structuredClone(ballots[0]); partialRank[2].value = ['P'];
  [s, j] = await call('v1', 'POST', `${P}/vote`, { answers: partialRank, receiptHash: receipt().hash }); ok('an incomplete ranking is refused', s === 400, j?.error);
  const badStar = structuredClone(ballots[0]); badStar[4].value = { S1: 6, S2: 1 };
  [s, j] = await call('v1', 'POST', `${P}/vote`, { answers: badStar, receiptHash: receipt().hash }); ok('a 6-star rating is refused', s === 400, j?.error);
  [s, j] = await call('v1', 'POST', `${P}/vote`, { answers: ballots[0].slice(0, 7), receiptHash: receipt().hash }); ok('a missing answer is refused', s === 400, j?.error);
  [s] = await call('v1', 'POST', `${P}/vote`, { answers: ballots[0] }); ok('a ballot without a receipt is refused', s === 400, s);
  [s] = await call('outsider', 'POST', `${P}/vote`, { answers: ballots[0], receiptHash: receipt().hash }); ok('a non-member cannot vote', s === 404 || s === 403, s);
  [s] = await call(null, 'POST', `/api/polls/${pid}/vote`, { code: 'AAAA-BBBB-CCCC', answers: ballots[0], receiptHash: receipt().hash }); ok('a wrong code cannot vote', s === 404, s);

  // ── Voting: v1 first votes differently, then changes their vote
  const receipts = {};
  const first = structuredClone(ballots[0]); first[0].value = 'C'; first[3].value = ['D'];
  const r0 = receipt();
  [s, j] = await call('v1', 'POST', `${P}/vote`, { answers: first, receiptHash: r0.hash }); ok('v1 votes', s === 201 && !j.revoted, s);
  for (const [i, n] of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].entries()) {
    const r = receipt(); receipts[n] = r;
    [s, j] = await call(n, 'POST', `${P}/vote`, { answers: ballots[i], receiptHash: r.hash });
    if (n === 'v1') ok('v1 changes their vote (replaces the first ballot)', s === 201 && j.revoted, s);
    else if (s !== 201) ok(`${n} votes`, false, s);
  }
  for (const [i, code] of codes.entries()) {
    const r = receipt(); receipts[`code${i}`] = r;
    [s, j] = await call(null, 'POST', `/api/polls/${pid}/vote`, { code, answers: ballots[6 + i], receiptHash: r.hash });
    if (s !== 201) ok(`code ${i + 1} votes`, false, `${s} ${j?.error}`);
  }
  [s, j] = await call(null, 'POST', `/api/polls/${pid}`, { code: codes[0].toLowerCase().replace(/-/g, ' ') });
  ok('a code works however it is typed, and shows the voter their ballot', s === 200 && j.voted && eq(j.myBallot?.[0]?.value, 'A'), s);

  // ── How ballots are stored
  const { rows: stored } = await pool.query('SELECT ballot_token, user_id, code_id, response, created_at, superseded FROM poll_ballots WHERE poll_id = $1', [pid]);
  ok('9 ballots stored (8 counted + 1 replaced)', stored.length === 9 && stored.filter(b => b.superseded).length === 1, stored.length);
  ok('secret ballots: no voter, no code, no time', stored.every(b => !b.user_id && !b.code_id && !b.created_at));
  ok('secret ballots: encrypted', stored.every(b => b.response.startsWith(`enc2:${soc}:`)));
  const ids = Object.values(U).map(u => u.id);
  ok('ballot tokens reveal no voter id', stored.every(b => /^[0-9a-f]{64}$/.test(b.ballot_token) && !ids.some(id => b.ballot_token.includes(id.replace(/-/g, '')))));
  const { rows: [pc] } = await pool.query('SELECT count(*)::int AS n FROM poll_participants WHERE poll_id = $1', [pid]);
  ok('8 voters recorded', pc.n === 8, pc.n);

  // ── The count
  [s, j] = await call('v2', 'GET', `${P}/results`);
  const res = j.results; const t = Object.fromEntries(res.tallies.map(x => [x.questionId, x]));
  const counts = q => Object.fromEntries(t[q].options.map(o => [o.id, o.count]));
  ok('8 ballots counted (the replaced one is not)', res.total === 8, res.total);
  ok('single choice', eq(counts('q1'), expected.q1) && t.q1.winner === 'Option A', JSON.stringify(counts('q1')));
  ok('multiple choice', eq(counts('q2'), expected.q2), JSON.stringify(counts('q2')));
  ok('ranking: first choices', eq(counts('q3'), expected.q3.first), JSON.stringify(counts('q3')));
  const avg = Object.fromEntries(t.q3.options.map(o => [o.id, o.avgRank]));
  ok('ranking: average ranks', eq(Object.keys(expected.q3.avg).map(k => avg[k]), Object.values(expected.q3.avg)) && t.q3.winner === 'Option P', JSON.stringify(avg));
  const rounds = t.q4.rounds;
  ok('instant runoff: round counts', eq(rounds.map(r => Object.fromEntries(Object.entries(r.counts).sort())), expected.q4.rounds), JSON.stringify(rounds.map(r => r.counts)));
  ok('instant runoff: eliminations and exhausted ballots', eq(rounds.map(r => r.eliminated), expected.q4.eliminated) && eq(rounds.map(r => r.exhausted), expected.q4.exhausted));
  ok('instant runoff: B wins though A led on first choices', t.q4.winner === expected.q4.winner, t.q4.winner);
  const stars = Object.fromEntries(t.q5.options.map(o => [o.id, o.avgScore]));
  ok('star ratings', eq(stars, expected.q5) && t.q5.winner === 'Option S1', JSON.stringify(stars));
  ok('yes / no', eq(counts('q6'), expected.q6), JSON.stringify(counts('q6')));
  ok('scale', t.q7.average === expected.q7.average && t.q7.min === 1 && t.q7.max === 5 && eq(t.q7.distribution, expected.q7.distribution), `${t.q7.average}`);
  ok('word cloud (case and spaces ignored)', eq(t.q8.words, expected.q8), JSON.stringify(t.q8.words));
  ok('public comments shown', t.q1.comments.length === 8);
  ok('members do not see quiz marks while open', !res.quiz && t.q1.correctCount === undefined);

  // ── Accuracy check and audit log
  [s, j] = await call('pmod', 'GET', `${P}/verify`);
  ok('"Verify" passes every check', s === 200 && j.ok && j.replacedBallots === 1, j?.checks?.filter(c => !c.ok).map(c => c.label).join('; '));
  [s, j] = await call('v3', 'GET', `${P}/audit`);
  const hashOf = r => crypto.createHash('sha256').update(Buffer.from(r.secret, 'hex')).digest('hex');
  ok('audit log: 8 counted, 1 replaced', j.counted.length === 8 && j.replaced.length === 1 && j.voters === 8);
  ok('audit log: every voter finds their receipt', Object.values(receipts).every(r => j.counted.includes(hashOf(r))));
  ok("audit log: v1's first receipt is listed as replaced", j.replaced.includes(r0.hash));
  [s, j] = await call('pmod', 'GET', `${P}/participants`);
  ok('turnout: 8 voted, moderator not yet', j.voted.length === 8 && j.notYet.length === 1, `${j.voted.length} / ${j.notYet.length}`);

  // ── Closing
  [s] = await call('pmod', 'PATCH', P, { action: 'close' });
  [s, j] = await call('v4', 'POST', `${P}/vote`, { answers: ballots[3], receiptHash: receipt().hash }); ok('no votes after closing', s === 409, s);
  [s, j] = await call('v2', 'GET', `${P}/results`);
  ok('quiz marks shown after closing', j.results.quiz && j.results.tallies[0].correctCount === 4 && j.results.tallies[5].correctCount === 5 && j.results.quiz.outOf === 2,
    JSON.stringify(j.results.quiz));
  // Scores (Q1 = A, Q6 = yes): 2, 2, 0, 1, 1, 1, 1, 1
  ok('quiz score distribution', eq(j.results.quiz.distribution, { 0: 1, 1: 5, 2: 2 }) && j.results.quiz.average === 1.1, JSON.stringify(j.results.quiz.distribution));
  [s, j] = await call('pmod', 'GET', `${P}/verify`); ok('still verifies after closing', j.ok);

  // ── One vote only; results hidden until close; named ballots
  [s, j] = await call('pmod', 'POST', S, { payload: { title: 'VERIFY one-shot', questions: [payload.questions[5]] }, allow_revote: false, result_visibility: 'after_close', ballot_mode: 'named' });
  const P2 = `${S}/${j.id}`;
  await call('pmod', 'PATCH', P2, { action: 'open' });
  [s] = await call('v1', 'POST', `${P2}/vote`, { answers: [{ questionId: 'q6', value: 'yes' }], receiptHash: receipt().hash });
  [s, j] = await call('v1', 'POST', `${P2}/vote`, { answers: [{ questionId: 'q6', value: 'no' }], receiptHash: receipt().hash });
  ok('no second vote when changing is off', s === 409, s);
  [s, j] = await call('v1', 'GET', `${P2}/results`); ok('results hidden from members until it closes', j.results === null);
  [s, j] = await call('pmod', 'GET', P2); ok('named poll: moderator sees who chose what', j.results.voters?.[0]?.voter === '@VERIFY-v1-TEST');
  const { rows: [nb] } = await pool.query('SELECT user_id, response FROM poll_ballots WHERE poll_id = $1', [P2.split('/').pop()]);
  ok('named ballot still encrypted', nb.user_id === U.v1.id && nb.response.startsWith('enc2:'));

  // ── One question at a time (live meeting)
  [s, j] = await call('pmod', 'POST', S, { payload: { title: 'VERIFY live', questions: [payload.questions[0], payload.questions[5]] }, question_order: 'sequential', result_visibility: 'live' });
  const P3 = `${S}/${j.id}`;
  await call('pmod', 'PATCH', P3, { action: 'open' });
  [s, j] = await call('v2', 'GET', P3); ok('live poll opens one question', j.poll.open_questions === 1);
  [s] = await call('v2', 'POST', `${P3}/vote`, { answers: [ballots[1][0]], receiptHash: receipt().hash }); ok('answer the first question', s === 201, s);
  await call('pmod', 'PATCH', P3, { action: 'reveal' });
  [s, j] = await call('v2', 'POST', `${P3}/vote`, { answers: [ballots[1][0]], receiptHash: receipt().hash }); ok('the second question must be answered once open', s === 400, j?.error);
  [s] = await call('v2', 'POST', `${P3}/vote`, { answers: [ballots[1][0], ballots[1][5]], receiptHash: receipt().hash }); ok('answer both', s === 201, s);
  [s, j] = await call('pmod', 'GET', `${P3}/results`);
  ok('one voter, one counted ballot with both answers', j.results.total === 1 && j.results.tallies[1].responses === 1 && j.vote_count === 1);
  [s, j] = await call('pmod', 'GET', `${P3}/verify`); ok('live poll verifies', j.ok, j?.checks?.filter(c => !c.ok).map(c => c.label).join('; '));
} catch (err) {
  failures++;
  console.log('FAIL  the test itself crashed:', err?.stack ?? err);
} finally {
  const ids = Object.values(U).map(u => u.id);
  await pool.query('DELETE FROM customer_roles WHERE user_id = ANY($1::text[]) OR tenant_id = $2', [ids, soc ?? -1]);
  await pool.query('DELETE FROM customer_members WHERE user_id = ANY($1::text[]) OR customer_id = $2', [ids, soc ?? -1]);
  if (soc) await pool.query('DELETE FROM customers WHERE id = $1', [soc]);          // polls, ballots, codes cascade
  await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids]);
  await pool.end();
  console.log(failures ? `\n${failures} FAILED` : '\nAll poll accuracy tests passed');
  process.exitCode = failures ? 1 : 0;
}
