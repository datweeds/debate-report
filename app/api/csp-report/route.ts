import { NextRequest } from 'next/server';

// Browsers report what the Content Security Policy blocked (or would block,
// while it is report-only). Logged once per page + directive + blocked address,
// so a noisy page can't flood the log.
const seen = new Set<string>();
const strip = (v: unknown, n: number) => String(v ?? '').split(/[?#]/)[0].slice(0, n);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { 'csp-report'?: Record<string, unknown> } | null;
  const r = body?.['csp-report'];
  if (r && seen.size < 500) {
    const page = strip(r['document-uri'], 200);
    const directive = strip(r['violated-directive'] ?? r['effective-directive'], 60);
    const blocked = strip(r['blocked-uri'], 200);
    const key = `${page}|${directive}|${blocked}`;
    if (!seen.has(key)) {
      seen.add(key);
      const src = r['source-file'] ? ` (${strip(r['source-file'], 120)}:${r['line-number'] ?? ''})` : '';
      console.log(`[csp] ${directive} blocked ${blocked || '(inline)'} on ${page}${src}`);
    }
  }
  return new Response(null, { status: 204 });
}
