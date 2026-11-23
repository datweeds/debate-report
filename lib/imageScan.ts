import crypto from 'crypto';
import pool from './db';
import { sealText } from './societyCrypto';
import { ageBandOf, isUnder18 } from './age';
import { PRODUCT_URL, sendContactNotification } from './postmark';
import { QUARANTINE_DAYS, quarantineImage } from './quarantine';

// Every uploaded image is checked on our own server before it is saved, on
// every plan. Sealed uploads (encrypted in the browser) can't be checked and
// never reach here. An explicit image is refused and held in encrypted
// quarantine for the platform team to review (lib/quarantine.ts), then deleted. If the scanner is down, uploads carry on.
const SCANNER_URL = process.env.SCANNER_URL ?? '';
const SCANNER_KEY = process.env.SCANNER_API_KEY ?? '';

export const EXPLICIT_IMAGE_MESSAGE =
  'This image looks sexually explicit, which isn’t allowed on new.vote, so it wasn’t uploaded. If you think we’ve got this wrong, contact us.';

function looksLikeImage(b: Buffer, mime: string): boolean {
  if (/^image\//i.test(mime) && !/svg/i.test(mime)) return true;
  if (b.length < 12) return false;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;                         // JPEG
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true; // PNG
  const head = b.subarray(0, 4).toString('latin1');
  if (head === 'GIF8') return true;
  if (head === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return true;
  return false;
}

type Verdict = { flagged: boolean; flags: string[]; score?: number | null };

export async function screenImageUpload(input: {
  bytes: Buffer; mime: string; fileName?: string | null;
  userId: string | null; societyId: number | null; where: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!SCANNER_URL || !looksLikeImage(input.bytes, input.mime)) return { ok: true };
  let verdict: Verdict | null = null;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/octet-stream' };
    if (SCANNER_KEY) headers['X-Api-Key'] = SCANNER_KEY;
    const r = await fetch(`${SCANNER_URL}/moderate-image`, {
      method: 'POST', headers, body: new Uint8Array(input.bytes), signal: AbortSignal.timeout(20_000),
    });
    if (r.ok) verdict = await r.json() as Verdict;
    else if (r.status !== 422) console.warn('[image-scan] scanner returned', r.status);
  } catch (err) {
    console.warn('[image-scan] scanner unavailable', err);
  }
  if (!verdict?.flagged) return { ok: true };

  const minor = isUnder18(await ageBandOf(input.userId));
  const name = input.fileName ? ` “${input.fileName.slice(0, 200)}”` : '';
  try {
    const { rows: [alert] } = await pool.query(
      `INSERT INTO content_alerts (content_type, content_key, customer_id, flagged_text, flags, author_id, report_route, urgent, involves_minor)
       VALUES ('image_upload', $1, $2, '', $3::text[], $4, 'platform', true, $5) RETURNING id`,
      [crypto.randomUUID(), input.societyId, verdict.flags, input.userId, minor]);
    let held = false;
    try { held = await quarantineImage(alert.id, input.bytes, input.mime); } catch (err) { console.error('[image-scan] quarantine', err); }
    const text = `Image upload blocked (${input.where})${name}: explicit-image score ${verdict.score ?? 'n/a'}. ` +
      (held ? `Held in encrypted quarantine for review; deleted automatically after ${QUARANTINE_DAYS} days.` : 'It could not be held for review (master key not loaded), so it was not stored.');
    await pool.query('UPDATE content_alerts SET flagged_text = $2 WHERE id = $1', [alert.id, await sealText(input.societyId, text)]);
    void sendContactNotification({
      name: 'new.vote', email: 'contact@new.vote',
      subject: `URGENT: ${minor ? 'Under 18 involved: ' : ''}explicit image blocked at upload`,
      message: `An upload was blocked as sexually explicit (${input.where}). ${held ? `It is held in encrypted quarantine for ${QUARANTINE_DAYS} days.` : 'It could not be held for review.'}\n\nReview it in the alert queue: ${PRODUCT_URL}/dashboard/scanner`,
      context: 'new.vote moderation notices',
    }).catch(err => console.error('[image-scan] notify', err));
  } catch (err) {
    console.error('[image-scan] alert', err);
  }
  return { ok: false, error: EXPLICIT_IMAGE_MESSAGE };
}
