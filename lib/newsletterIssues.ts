import pool from './db';

// Put these topics (in this order) in a draft issue, releasing any it no longer
// includes. A topic already in another issue is skipped: it can't go out twice.
export async function setIssueTopics(issueId: string, topicIds: unknown[]): Promise<{ skipped: number }> {
  const ids = topicIds.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE newsletter_topics SET issue_id = NULL, position = 0 WHERE issue_id = $1 AND NOT (id = ANY($2::uuid[]))`, [issueId, ids]);
    let skipped = 0;
    for (const [n, id] of ids.entries()) {
      const { rowCount } = await client.query(
        `UPDATE newsletter_topics SET issue_id = $1, position = $3, updated_at = now() WHERE id = $2 AND (issue_id IS NULL OR issue_id = $1)`,
        [issueId, id, n]);
      if (!rowCount) skipped++;
    }
    await client.query('COMMIT');
    return { skipped };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
