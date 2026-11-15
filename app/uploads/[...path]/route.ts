import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

// `next start` only serves files that were in public/ at build time, so images
// uploaded at runtime (debate images, society dashboard images) would 404
// until the next rebuild. This serves public/uploads/** straight from disk.
// Only image files, only simple names — no path traversal.

const TYPES: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
};
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const root = path.join(process.cwd(), 'public', 'uploads');

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const segments = (await params).path;
  if (!segments.length || segments.some(s => !SAFE_SEGMENT.test(s) || s.startsWith('.'))) {
    return new NextResponse('Not found', { status: 404 });
  }
  const type = TYPES[path.extname(segments[segments.length - 1]).toLowerCase()];
  if (!type) return new NextResponse('Not found', { status: 404 });

  try {
    const data = await readFile(path.join(root, ...segments));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': type,
        // Upload filenames change on replace, so these are safe to cache.
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
