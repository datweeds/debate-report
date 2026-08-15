#!/usr/bin/env npx ts-node
/**
 * Generate AI synopses for Scottish Parliament bills.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." ANTHROPIC_API_KEY="sk-..." \
 *     npx ts-node scripts/generate_synopses.ts [--all]
 *
 * By default only fills bills where synopsis IS NULL.
 * Pass --all to regenerate all synopses.
 */

import Anthropic from '@anthropic-ai/sdk';
import { Pool } from 'pg';

const client = new Anthropic();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BATCH_SIZE = 10;

async function generateSynopsis(bill: {
  short_name: string;
  full_name: string;
  bill_type: string | null;
  reference: string | null;
}): Promise<string> {
  const prompt = `You are a knowledgeable analyst specialising in Scottish Parliament legislation.

Write a two-paragraph synopsis of the following Scottish Parliament bill. The first paragraph should explain the bill's main purpose and the problems or context it addresses. The second paragraph should cover the key provisions, mechanisms, or changes it introduces, and (if known) its outcome or current status. Write in plain English suitable for an informed but non-specialist reader. Do not begin with "This bill". Be factual and neutral.

Bill: ${bill.full_name}
Short name: ${bill.short_name}
Type: ${bill.bill_type ?? 'unknown'}
Reference: ${bill.reference ?? 'unknown'}

Synopsis:`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 450,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0];
  if (text.type !== 'text') throw new Error('Unexpected response type');
  return text.text.trim();
}

async function main() {
  const regenerateAll = process.argv.includes('--all');

  const { rows: bills } = await pool.query<{
    id: number;
    short_name: string;
    full_name: string;
    bill_type: string | null;
    reference: string | null;
  }>(
    `SELECT b.id, b.short_name, b.full_name, bt.name AS bill_type, b.reference
     FROM sp_bills b
     LEFT JOIN sp_bill_types bt ON bt.id = b.bill_type_id
     ${regenerateAll ? '' : 'WHERE b.synopsis IS NULL'}
     ORDER BY b.id`
  );

  console.log(`Found ${bills.length} bills to process${regenerateAll ? ' (--all mode)' : ''}`);
  if (bills.length === 0) {
    console.log('Nothing to do.');
    await pool.end();
    return;
  }

  let done = 0;
  let failed = 0;

  for (let i = 0; i < bills.length; i += BATCH_SIZE) {
    const batch = bills.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (bill) => {
        try {
          const synopsis = await generateSynopsis(bill);
          await pool.query('UPDATE sp_bills SET synopsis = $1 WHERE id = $2', [synopsis, bill.id]);
          done++;
          console.log(`[${done + failed}/${bills.length}] ✓ ${bill.short_name}`);
        } catch (err) {
          failed++;
          console.error(`[${done + failed}/${bills.length}] ✗ ${bill.short_name}: ${err}`);
        }
      })
    );

    // Small delay between batches to stay well within rate limits
    if (i + BATCH_SIZE < bills.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\nDone. ${done} succeeded, ${failed} failed.`);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
