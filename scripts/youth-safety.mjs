// Age bands and youth protections, against the running app (localhost:3004):
// sign-up needs an age group; bands move up, never down; members aged 13-15
// join calls only in youth-group Societies; under-18 Society Admins aren't on
// the public About page; Society Admins see an "Under 18" marker; an uploaded
// image is scanned and, when clean, stored. Creates its own VERIFY-* Society
// and users and removes them at the end. Sends no email (no reports are made,
// and no upload is blocked).
//
//   cd ~/debate-report && node scripts/youth-safety.mjs

import fs from 'fs';
import pg from 'pg';
import { SignJWT } from 'jose';

const env = ['.env.local', '.env.production.local', '.env'].filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');
const get = k => [...env.matchAll(new RegExp('^' + k + '=["\']?([^"\'\\n]+)', 'mg'))].map(m => m[1]).at(-1);
const pool = new pg.Pool({ connectionString: get('DATABASE_URL') });
const B = process.env.BASE_URL ?? 'http://localhost:3004';
const U = {};
let failures = 0, soc = null;
const ok = (label, cond, detail = '') => { if (!cond) failures++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail !== '' ? `  (${detail})` : ''}`); };

async function user(n, band) {
  const { rows: [u] } = await pool.query(
    `INSERT INTO users (user_handle, user_tier, user_plan, access_code, is_sys_admin, age_band) VALUES ($1, 'debater', 'free', 'x-' || $1, false, $2) RETURNING id`,
    [`VERIFY-${n}-TEST`, band]);
  U[n] = { id: u.id, handle: `VERIFY-${n}-TEST`, tok: await new SignJWT({ sub: u.id, handle: `VERIFY-${n}-TEST`, isSysAdmin: false, isScotparlMod: false, tier: 'debater', plan: 'free', customerAdminTenants: [], topicOwnerTenants: [] })
    .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode(get('JWT_SECRET'))) };
}
const hdr = who => (who ? { Cookie: 'dr_session=' + U[who].tok } : {});
const call = async (who, method, path, body) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...hdr(who) }, body: body && JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch { /* not JSON */ } return [r.status, j];
};

try {
  // ── Sign-up asks for an age group ─────────────────────────────────────────
  const opts = body => fetch(B + '/api/auth/passkey/register-options', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let r = await opts({ userHandle: 'verify_age_none', agreed: true });
  ok('sign-up without an age group is refused', r.status === 400, (await r.json()).error);
  r = await opts({ userHandle: 'verify_age_bad', agreed: true, ageBand: '10-12' });
  ok('an age group under 13 is refused', r.status === 400);
  r = await opts({ userHandle: 'verify_age_ok', agreed: true, ageBand: '16-17' });
  ok('sign-up with an age group and the Terms goes ahead', r.status === 200);
  r = await opts({ userHandle: 'verify_age_noterms', ageBand: '18+' });
  ok('sign-up without agreeing to the Terms is refused', r.status === 400);

  await user('admin', '18+'); await user('young', '13-15'); await user('teen', '16-17'); await user('adult', '18+'); await user('asker', '13-15');

  // ── Bands move up, never down ─────────────────────────────────────────────
  let [s, j] = await call('teen', 'GET', '/api/user/age-band');
  ok('your age group is shown', s === 200 && j.band === '16-17', j?.band);
  [s, j] = await call('teen', 'PATCH', '/api/user/age-band', { band: '13-15' });
  ok('moving down an age group is refused', s === 400, j?.error);
  [s, j] = await call('young', 'PATCH', '/api/user/age-band', { band: '16-17' });
  ok('moving up an age group works', s === 200 && j.band === '16-17');
  await pool.query(`UPDATE users SET age_band = '13-15' WHERE id = $1`, [U.young.id]);

  // ── A public Society, with an adult and a 16-17 Society Admin ─────────────
  soc = (await pool.query(`INSERT INTO customers (name, subdomain, status, visibility) VALUES ('VERIFY Youth Soc', 'verify-youth-soc', 'active', 'public') RETURNING id`)).rows[0].id;
  for (const n of ['admin', 'teen']) await pool.query(`INSERT INTO customer_roles (tenant_id, user_id, role) VALUES ($1, $2, 'customer_admin')`, [soc, U[n].id]);
  for (const n of ['admin', 'teen', 'young', 'adult']) await pool.query('INSERT INTO customer_members (customer_id, user_id) VALUES ($1, $2)', [soc, U[n].id]);
  await pool.query(`INSERT INTO society_join_requests (customer_id, user_id, message) VALUES ($1, $2, 'please')`, [soc, U.asker.id]);

  // ── About page: under-18 Society Admins aren't listed publicly ───────────
  const about = await (await fetch(`${B}/society/${soc}/about`)).text();
  ok('the adult Society Admin is on the public About page', about.includes(U.admin.handle));
  ok('the 16-17 Society Admin is not on the public About page', !about.includes(U.teen.handle));

  // ── Society Admins see an Under 18 marker ─────────────────────────────────
  [s, j] = await call('admin', 'GET', `/api/manage/societies/${soc}`);
  const m = Object.fromEntries((j?.members ?? []).map(x => [x.user_id, x.under18]));
  ok('members aged 13-15 are marked under 18', m[U.young.id] === true);
  ok('members aged 16-17 are marked under 18', m[U.teen.id] === true);
  ok('adults are not marked', m[U.adult.id] === false);
  ok('join requests show the marker too', (j?.requests ?? []).find(x => x.user_id === U.asker.id)?.under18 === true);
  ok('the Society starts as not a youth group', j?.society?.youth_group === false);

  // ── Calls: 13-15s only in youth groups ────────────────────────────────────
  const { rows: [room] } = await pool.query(`INSERT INTO society_rtc_rooms (customer_id, name, is_default) VALUES ($1, 'VERIFY room', TRUE) RETURNING id`, [soc]);
  const tokenPath = `/api/societies/${soc}/rtc/rooms/${room.id}/token`;
  [s, j] = await call('young', 'POST', tokenPath);
  ok('a 13-15 member can’t join a call outside a youth group', s === 403 && /youth group/.test(j?.error ?? ''), j?.error);
  [s, j] = await call('teen', 'POST', tokenPath);
  ok('a 16-17 member can join', s === 200 || s === 503, `${s}`);
  [s, j] = await call('adult', 'POST', tokenPath);
  ok('an adult member can join', s === 200 || s === 503, `${s}`);
  [s] = await call('young', 'PATCH', `/api/manage/societies/${soc}`, { youth_group: true });
  ok('a member who isn’t a Society Admin can’t make it a youth group', s === 404 || s === 403, `${s}`);
  [s] = await call('admin', 'PATCH', `/api/manage/societies/${soc}`, { youth_group: true });
  ok('a Society Admin can make it a youth group', s === 200);
  [s, j] = await call('young', 'POST', tokenPath);
  ok('then a 13-15 member can join its calls', s === 200 || s === 503, `${s} ${j?.error ?? ''}`);

  // ── Uploaded images are scanned; a clean one is stored ───────────────────
  const img = fs.readFileSync('public/og-image.jpg');
  const form = new FormData();
  form.append('file', new Blob([img], { type: 'image/jpeg' }), 'verify-photo.jpg');
  const up = await fetch(`${B}/api/societies/${soc}/documents`, { method: 'POST', headers: hdr('adult'), body: form });
  const upj = await up.json().catch(() => ({}));
  ok('a clean photo is scanned and stored', up.status === 201 && !!upj.id, `${up.status} ${upj.error ?? ''}`);
  const scans = await (await fetch('http://localhost:5001/health')).json();
  ok('the image scanner is running', scans.images === true);
} catch (err) {
  failures++;
  console.error('ERROR', err);
} finally {
  const ids = Object.values(U).map(u => u.id);
  if (soc) {
    const { rows: docs } = await pool.query('SELECT stored_name FROM documents WHERE customer_id = $1', [soc]);
    for (const d of docs) { try { fs.unlinkSync(`uploads/societies/${soc}/${d.stored_name}`); } catch { /* elsewhere */ } }
    await pool.query('DELETE FROM documents WHERE customer_id = $1', [soc]);
    await pool.query('DELETE FROM society_join_requests WHERE customer_id = $1', [soc]);
  }
  await pool.query('DELETE FROM customer_roles WHERE user_id = ANY($1::text[]) OR tenant_id = $2', [ids, soc ?? -1]);
  await pool.query('DELETE FROM customer_members WHERE user_id = ANY($1::text[]) OR customer_id = $2', [ids, soc ?? -1]);
  if (soc) await pool.query('DELETE FROM customers WHERE id = $1', [soc]);
  await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids]);
  await pool.end();
  console.log(failures ? `\n${failures} FAILED` : '\nAll youth safety tests passed');
}
