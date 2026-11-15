// Running and reading Debate Quality Reports. Server-only.

import pool from '@/lib/db';
import type { SessionPayload } from '@/lib/auth';
import { isSocietyModerator } from '@/lib/roles';
import { runRules, qualityScore, checkDraft, type Finding, type QDebate } from './rules';
import { aiReview } from './ai';

export type DebateRow = { id: string; stat_title: string; stat_description: string | null; customer_id: number | null };

// Only the debate's Society moderators review its quality.
export async function canReviewQuality(session: SessionPayload | null, debate: Pick<DebateRow, 'customer_id'>): Promise<boolean> {
  return isSocietyModerator(session, debate.customer_id);
}

export async function getDebate(resolutionId: string): Promise<DebateRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(resolutionId)) return null;
  const { rows } = await pool.query(
    `SELECT id, stat_title, stat_description, customer_id FROM statements
     WHERE id = $1 AND stat_type = 'resolution'`,
    [resolutionId],
  );
  return rows[0] ?? null;
}

export async function loadDebate(res: DebateRow): Promise<QDebate> {
  const [{ rows: statements }, { rows: relationships }] = await Promise.all([
    pool.query(
      `SELECT id, stat_type::text, stat_direction::text, stat_title, stat_description, stat_ref, retracted_at
       FROM statements WHERE resolution_id = $1`,
      [res.id],
    ),
    pool.query(
      `SELECT stat_id_supported, stat_id_supported_by FROM stat_relationships
       WHERE stat_id_supported = $1
          OR stat_id_supported_by IN (SELECT id FROM statements WHERE resolution_id = $1)`,
      [res.id],
    ),
  ]);
  return { resolution: res, statements, relationships };
}

// Creates the report row and runs the checks in the background (the AI review
// can take a minute or two, longer than a proxied request should wait).
export async function startReport(res: DebateRow, userId: string): Promise<string> {
  const { rows: [running] } = await pool.query(
    `SELECT id FROM quality_reports
     WHERE resolution_id = $1 AND status = 'running' AND created_at > now() - interval '10 minutes'`,
    [res.id],
  );
  if (running) return running.id;

  const { rows: [report] } = await pool.query(
    'INSERT INTO quality_reports (resolution_id, created_by) VALUES ($1, $2) RETURNING id',
    [res.id, userId],
  );
  void executeReport(report.id, res).catch(err => console.error('quality report failed:', err));
  return report.id;
}

async function executeReport(reportId: string, res: DebateRow) {
  try {
    const debate = await loadDebate(res);
    const liveCount = debate.statements.filter(s => !s.retracted_at).length;
    const { rows: dismissedRows } = await pool.query(
      'SELECT fingerprint, observation FROM quality_dismissals WHERE resolution_id = $1',
      [res.id],
    );
    const dismissed = new Set(dismissedRows.map(d => d.fingerprint as string));

    // Open AI findings from the last completed run, so persisting issues keep their identity
    const { rows: previous } = await pool.query(
      `SELECT f.fingerprint AS key, COALESCE(s.stat_ref, f.stat_ref) AS ref, f.observation
       FROM quality_findings f
       LEFT JOIN statements s ON s.id = f.statement_id
       WHERE f.source = 'ai' AND f.report_id = (
         SELECT id FROM quality_reports
         WHERE resolution_id = $1 AND status = 'complete' AND id <> $2
         ORDER BY created_at DESC LIMIT 1)`,
      [res.id, reportId],
    );

    const ruleFindings = runRules(debate);
    let aiFindings: Finding[] = [];
    let aiModel: string | null = null, aiSummary: string | null = null, aiError: string | null = null;
    try {
      const ai = await aiReview(
        debate,
        dismissedRows.map(d => d.observation).filter(Boolean),
        previous.filter(p => !dismissed.has(p.key)),
      );
      aiFindings = ai.findings; aiModel = ai.model; aiSummary = ai.summary;
    } catch (err) {
      console.error('quality AI review failed:', err);
      aiError = 'The AI review could not be completed; the rule checks below are still valid.';
    }

    const all = [
      ...ruleFindings.map(f => ({ ...f, source: 'rules' as const })),
      ...aiFindings.map(f => ({ ...f, source: 'ai' as const })),
    ];
    const counted = all.filter(f => !dismissed.has(f.fingerprint));
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const f of all) {
        await client.query(
          `INSERT INTO quality_findings
             (report_id, source, rule_id, fingerprint, severity, category, statement_id, stat_ref,
              fallacy_name, observation, recommendation)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [reportId, f.source, f.ruleId, f.fingerprint, f.severity, f.category, f.statementId, f.ref,
           f.fallacy ?? null, f.observation, f.recommendation],
        );
      }
      await client.query(
        `UPDATE quality_reports
         SET status = 'complete', finished_at = now(), statement_count = $2, score = $3,
             ai_model = $4, ai_summary = $5, ai_error = $6
         WHERE id = $1`,
        [reportId, liveCount, qualityScore(counted, liveCount), aiModel, aiSummary, aiError],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    await pool.query(
      `UPDATE quality_reports SET status = 'failed', finished_at = now(), ai_error = $2 WHERE id = $1`,
      [reportId, 'The report could not be completed. Please try again.'],
    );
    throw err;
  }
}

export type ReportFinding = Finding & {
  id: string;
  source: 'rules' | 'ai';
  status: 'new' | 'open' | 'dismissed';
  dismissedNote?: string | null;
};

// A report with each finding marked New / Still open / Dismissed against the
// previous completed report, plus what the previous report had that is now gone.
export async function getReport(resolutionId: string, reportId?: string) {
  const { rows: history } = await pool.query(
    `SELECT r.id, r.created_at, r.finished_at, r.status, r.score, r.statement_count,
            u.user_handle AS run_by,
            (SELECT COUNT(*)::int FROM quality_findings f WHERE f.report_id = r.id) AS finding_count
     FROM quality_reports r LEFT JOIN users u ON u.id = r.created_by
     WHERE r.resolution_id = $1 ORDER BY r.created_at DESC LIMIT 50`,
    [resolutionId],
  );
  const report = reportId ? history.find(h => h.id === reportId) : history[0];
  if (!report) return { history, report: null, findings: [], resolved: [] };

  const { rows: [detail] } = await pool.query(
    'SELECT ai_model, ai_summary, ai_error FROM quality_reports WHERE id = $1', [report.id],
  );
  const previous = history.find(h => h.status === 'complete' && new Date(h.created_at) < new Date(report.created_at));

  const [{ rows: findings }, { rows: prevFindings }, { rows: dismissals }] = await Promise.all([
    pool.query(
      `SELECT f.id, f.source, f.rule_id AS "ruleId", f.fingerprint, f.severity, f.category,
              f.statement_id AS "statementId", COALESCE(s.stat_ref, f.stat_ref) AS ref,
              f.fallacy_name AS fallacy, f.observation, f.recommendation
       FROM quality_findings f LEFT JOIN statements s ON s.id = f.statement_id
       WHERE f.report_id = $1`,
      [report.id],
    ),
    previous
      ? pool.query(
          `SELECT f.fingerprint, f.severity, f.category, f.statement_id AS "statementId",
                  COALESCE(s.stat_ref, f.stat_ref) AS ref, f.observation, f.source
           FROM quality_findings f LEFT JOIN statements s ON s.id = f.statement_id
           WHERE f.report_id = $1`,
          [previous.id],
        )
      : Promise.resolve({ rows: [] }),
    pool.query('SELECT fingerprint, note FROM quality_dismissals WHERE resolution_id = $1', [resolutionId]),
  ]);

  const dismissedNote = new Map(dismissals.map(d => [d.fingerprint, d.note]));
  const prevSet = new Set(prevFindings.map(f => f.fingerprint));
  const currentSet = new Set(findings.map(f => f.fingerprint));
  const out: ReportFinding[] = findings.map(f => ({
    ...f,
    status: dismissedNote.has(f.fingerprint) ? 'dismissed' : !previous || prevSet.has(f.fingerprint) ? 'open' : 'new',
    dismissedNote: dismissedNote.get(f.fingerprint) ?? null,
  }));
  const resolved = prevFindings.filter(f => !currentSet.has(f.fingerprint) && !dismissedNote.has(f.fingerprint));

  return {
    history,
    report: { ...report, ...detail, previousId: previous?.id ?? null },
    findings: out,
    resolved,
  };
}

// Quality warnings for one saved statement (returned by the API on create/update).
export async function statementWarnings(resolutionId: string | null | undefined, statementId: string) {
  const res = resolutionId ? await getDebate(resolutionId) : null;
  if (!res) return [];
  const debate = await loadDebate(res);
  const s = debate.statements.find(x => x.id === statementId);
  if (!s) return [];
  return checkDraft({ ...s, stat_ref: s.stat_ref ?? null }, debate)
    .map(({ severity, ruleId, observation, recommendation }) => ({ severity, rule: ruleId, observation, recommendation }));
}
