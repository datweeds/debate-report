// RFC 9116 (securitytxt.org): how to report a security problem.
// Generated so its expiry date always stays a year ahead.
export const dynamic = 'force-dynamic';

export function GET() {
  const expires = new Date(Date.now() + 365 * 864e5);
  expires.setUTCHours(0, 0, 0, 0);
  const body = [
    'Contact: mailto:security@new.vote',
    'Contact: https://new.vote/contact',
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: en',
    'Policy: https://new.vote/security',
    'Canonical: https://new.vote/.well-known/security.txt',
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
}
