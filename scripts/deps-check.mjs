// Weekly dependency vulnerability check (cron, Mondays 06:00):
//   - the site's npm packages (production only): npm audit
//   - the scanner's Python packages (user site): pip-audit
//   - the News service's Python project: pip-audit
// Writes ~/.config/backup/deps-status.json (shown in Analytics, System health)
// and emails the team when anything high or critical is found, or a check fails.
// The vulnerability process (fix within 14 days) is in the Secure development framework.
//
//   cd ~/debate-report && node scripts/deps-check.mjs [--no-email]

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const HOME = os.homedir();
const env = ['.env.local', '.env.production.local'].filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');
const get = k => [...env.matchAll(new RegExp('^' + k + '=["\']?([^"\'\\n]+)', 'mg'))].map(m => m[1]).at(-1);
const noEmail = process.argv.includes('--no-email');

const run = (cmd, args, cwd) => {
  try { return execFileSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: 15 * 60 * 1000 }); }
  catch (e) { if (e.stdout) return e.stdout; throw e; }      // audit tools exit non-zero when they find something
};

const findings = [];   // { where, name, version, id, severity, fix }
const failures = [];

// ── npm ───────────────────────────────────────────────────────────────────
try {
  const out = JSON.parse(run('npm', ['audit', '--omit=dev', '--json'], path.join(HOME, 'debate-report')));
  for (const [name, v] of Object.entries(out.vulnerabilities ?? {})) {
    const advisories = (v.via ?? []).filter(x => typeof x === 'object');
    if (!advisories.length) continue;   // only pulled in by another vulnerable package; that one is listed
    for (const a of advisories) {
      findings.push({ where: 'site (npm)', name, version: v.range, id: a.url ?? a.source, severity: a.severity ?? v.severity,
        fix: v.fixAvailable ? (v.fixAvailable === true ? 'npm audit fix' : `update ${v.fixAvailable.name} to ${v.fixAvailable.version}`) : 'no fix yet' });
    }
  }
} catch (e) { failures.push(`npm audit: ${String(e.message).split('\n')[0]}`); }

// ── Python (pip-audit gives no severity: treat every finding as high until assessed) ──
const pipAudit = (where, args, cwd) => {
  try {
    const out = JSON.parse(run('python3', ['-m', 'pip_audit', '--format', 'json', '--progress-spinner', 'off', ...args], cwd));
    for (const d of out.dependencies ?? []) {
      for (const v of d.vulns ?? []) {
        findings.push({ where, name: d.name, version: d.version, id: v.id, severity: 'high (unassessed)',
          fix: v.fix_versions?.length ? `upgrade to ${v.fix_versions.at(-1)}` : 'no fix yet' });
      }
    }
  } catch (e) { failures.push(`${where}: ${String(e.message).split('\n')[0]}`); }
};
// The scanner runs on this server's Python with packages in the user site
const userReqs = path.join(os.tmpdir(), `scanner-reqs-${process.pid}.txt`);
try {
  fs.writeFileSync(userReqs, run('python3', ['-m', 'pip', 'freeze', '--user']));
  pipAudit('scanner (Python)', ['-r', userReqs, '--no-deps', '--disable-pip']);
} catch (e) { failures.push(`scanner: ${String(e.message).split('\n')[0]}`); }
finally { fs.rmSync(userReqs, { force: true }); }
// The News service: what is actually installed in its running container
const newsReqs = path.join(os.tmpdir(), `news-reqs-${process.pid}.txt`);
try {
  const frozen = run('docker', ['exec', 'news-api-1', 'pip', 'freeze', '--exclude-editable']);
  if (frozen.trim()) { fs.writeFileSync(newsReqs, frozen); pipAudit('News (Python)', ['-r', newsReqs, '--no-deps', '--disable-pip']); }
} catch (e) { failures.push(`News: ${String(e.message).split('\n')[0]}`); }
finally { fs.rmSync(newsReqs, { force: true }); }

// ── Record and tell ───────────────────────────────────────────────────────
const serious = findings.filter(f => /critical|high/.test(f.severity));
const ok = failures.length === 0 && serious.length === 0;
const message = failures.length
  ? `check failed: ${failures.join('; ')}`
  : findings.length ? `${findings.length} known vulnerabilit${findings.length === 1 ? 'y' : 'ies'} (${serious.length} high or critical): fix within 14 days` : 'no known vulnerabilities';
const status = { ok, at: new Date().toISOString(), message, bytes: 0,
  warnings: findings.map(f => `${f.severity}: ${f.where} ${f.name} ${f.version ?? ''} (${f.id}): ${f.fix}`) };
fs.mkdirSync(path.join(HOME, '.config', 'backup'), { recursive: true });
fs.writeFileSync(path.join(HOME, '.config', 'backup', 'deps-status.json'), JSON.stringify(status, null, 1));
console.log(`${status.at} ${message}`);
for (const w of status.warnings) console.log('  ' + w);

if (!ok && !noEmail) {
  const token = get('POSTMARK_SERVER_TOKEN');
  const from = get('CONTACT_FROM_EMAIL') ?? 'contact@new.vote', to = get('SECURITY_ALERT_EMAIL') ?? get('CONTACT_TO_EMAIL') ?? 'contact@new.vote';
  if (token) {
    const r = await fetch('https://api.postmarkapp.com/email', { method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': token },
      body: JSON.stringify({ From: `new.vote security <${from}>`, To: to, MessageStream: 'outbound',
        Subject: `[new.vote security] Dependency check: ${message}`.slice(0, 250),
        TextBody: `Weekly dependency check, ${status.at}\n\n${message}\n\n${status.warnings.join('\n') || ''}\n\n` +
          `Follow the vulnerability process (Secure development framework): assess, fix high and critical within 14 days, record it.` }) });
    if (!r.ok) console.error('email failed', r.status);
  }
}
