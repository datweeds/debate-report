// Sending a finished export ZIP to the browser, then removing the temporary copy. Server-only.

import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';

// One export at a time per person: they're heavy
const running = new Set<string>();

export async function sendExport(key: string, make: () => Promise<{ file: string; filename: string; cleanup: () => Promise<unknown> }>) {
  if (running.has(key)) return Response.json({ error: 'An export is already being prepared. Please wait for it to finish.' }, { status: 429 });
  running.add(key);
  try {
    const { file, filename, cleanup } = await make();
    const { size } = await stat(file);
    const stream = createReadStream(file);
    stream.on('close', () => { cleanup(); });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(size),
        'Content-Disposition': `attachment; filename="${filename.replace(/[^\w.\-]/g, '_')}"`,
        'Cache-Control': 'no-store',
      },
    });
  } finally {
    running.delete(key);
  }
}
