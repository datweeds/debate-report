import net from 'net';

// The visitor's IP address. new.vote sits behind Cloudflare, so nginx sees
// Cloudflare's address; Cloudflare passes the real one in CF-Connecting-IP.
// That header is trusted only when the request really came from Cloudflare
// (anyone reaching the server directly could otherwise fake it).
// Ranges from https://www.cloudflare.com/ips (checked 2026-11-21).
const V4 = ['173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18',
  '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22'];
const V6 = ['2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32'];

const cloudflare = new net.BlockList();
for (const c of V4) { const [a, p] = c.split('/'); cloudflare.addSubnet(a, Number(p), 'ipv4'); }
for (const c of V6) { const [a, p] = c.split('/'); cloudflare.addSubnet(a, Number(p), 'ipv6'); }

function fromCloudflare(ip: string): boolean {
  const v = net.isIP(ip);
  if (!v) return false;
  try { return cloudflare.check(ip, v === 4 ? 'ipv4' : 'ipv6'); } catch { return false; }
}

export function clientIp(h: Headers): string {
  const peer = (h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0] ?? '').trim();
  const real = h.get('cf-connecting-ip')?.trim();
  if (real && net.isIP(real) && fromCloudflare(peer)) return real;
  return peer || 'unknown';
}
