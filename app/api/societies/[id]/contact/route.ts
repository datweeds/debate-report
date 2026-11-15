import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { sendContactNotification } from '@/lib/postmark';

type Params = { params: Promise<{ id: string }> };

// POST { name, email, message, website } — email the Society's contact address
// (set by its moderators). Reply-To is the sender; the address itself is never shown.
export async function POST(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { name, email, message, website } = body as Record<string, string>;
  if (website) return NextResponse.json({ ok: true }, { status: 201 });   // honeypot
  if (!name?.trim() || name.length > 100) return NextResponse.json({ error: 'Your name is required' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email?.trim() ?? '')) return NextResponse.json({ error: 'A valid email is needed so they can reply' }, { status: 400 });
  if (!message?.trim() || message.length > 5000) return NextResponse.json({ error: 'Write a message (up to 5,000 characters)' }, { status: 400 });

  const { rows: [soc] } = await pool.query('SELECT name, contact_email FROM customers WHERE id = $1', [a.societyId]);
  if (!soc?.contact_email) return NextResponse.json({ error: 'This Society has no contact address' }, { status: 409 });
  try {
    await sendContactNotification({
      name: name.trim(), email: email.trim(), message: message.trim(),
      subject: `Message for ${soc.name}`, to: soc.contact_email,
      context: `${soc.name}'s About page on new.vote${a.session ? ` (sent by @${a.session.handle})` : ''}`,
    });
  } catch (err) {
    console.error('society contact email failed:', err);
    return NextResponse.json({ error: 'The message could not be sent. Please try again later.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
