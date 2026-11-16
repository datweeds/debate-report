// Encryption at rest for AI provider keys: AES-256-GCM with AI_SECRET_KEY
// (32 bytes, base64). Keys are never returned by any API or logged. Server-only.

import crypto from 'crypto';

function key(): Buffer {
  const k = Buffer.from(process.env.AI_SECRET_KEY ?? '', 'base64');
  if (k.length !== 32) throw new Error('AI_SECRET_KEY is not set up on this server');
  return k;
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return 'v1:' + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

export function decryptSecret(token: string): string {
  if (!token.startsWith('v1:')) throw new Error('Unknown secret format');
  const blob = Buffer.from(token.slice(3), 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), blob.subarray(0, 12));
  decipher.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]).toString('utf8');
}

export const secretsAvailable = () => Buffer.from(process.env.AI_SECRET_KEY ?? '', 'base64').length === 32;
