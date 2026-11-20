import type { NextConfig } from "next";

// Browser security headers for every page and API response.
// Meet connects to the LiveKit server, so its address is allowed for connections.
const livekit = (() => {
  try { const u = new URL(process.env.LIVEKIT_URL ?? ''); return `wss://${u.host} https://${u.host}`; } catch { return ''; }
})();
// Next.js puts small inline scripts in every page, so scripts allow 'unsafe-inline';
// everything else is limited to this site.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${livekit}`.trim(),
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
  "report-uri /api/csp-report",
].join('; ');
// Report-only while we check nothing is blocked; then switched to enforcing
const CSP_HEADER = process.env.CSP_ENFORCE === '1' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';

const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), display-capture=(self), fullscreen=(self), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: CSP_HEADER, value: CSP },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  experimental: {
    // Requests pass through proxy.ts, which by default buffers at most 10 MB.
    // Society documents can be up to 50 MB (moderators), plus form overhead.
    proxyClientMaxBodySize: 55 * 1024 * 1024,
  },
};

export default nextConfig;
