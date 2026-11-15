import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { runSweep } from '@/lib/scanner';

// GET — recent scan runs and alert totals, for Admin → Scanning.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const [{ rows: runs }, { rows: [totals] }, { rows: byType }] = await Promise.all([
    pool.query(
      `SELECT r.id, r.kind, r.started_at, r.finished_at, r.items_scanned, r.alerts_raised, r.error, u.user_handle AS started_by
       FROM scan_runs r LEFT JOIN users u ON u.id = r.started_by ORDER BY r.started_at DESC LIMIT 20`),
    pool.query(
      `SELECT (SELECT COUNT(*)::int FROM scanned_content) AS scanned,
              (SELECT COUNT(*)::int FROM content_alerts WHERE status = 'pending') AS pending,
              (SELECT COUNT(*)::int FROM content_alerts) AS alerts`),
    pool.query(`SELECT content_type, COUNT(*)::int AS n FROM scanned_content GROUP BY 1 ORDER BY 1`),
  ]);
  return NextResponse.json({ runs, totals, byType, configured: !!process.env.SCANNER_URL });
}

// POST { full? } — SysAdmin starts a scan now. Runs in the background.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { full } = await req.json().catch(() => ({}));
  void runSweep('manual', { full: full === true, startedBy: session.sub });
  return NextResponse.json({ started: true }, { status: 202 });
}
