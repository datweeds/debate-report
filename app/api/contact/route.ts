import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sendContactNotification } from '@/lib/postmark';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { name, email, subject, message, website } = body;

  if (website) return NextResponse.json({ ok: true }, { status: 201 }); // honeypot — silent reject

  if (!name?.trim())    return NextResponse.json({ error: 'Name is required' },    { status: 400 });
  if (!email?.trim())   return NextResponse.json({ error: 'Email is required' },   { status: 400 });
  if (!subject?.trim()) return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
  if (!message?.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

  if (name.trim().length    > 100)  return NextResponse.json({ error: 'Name too long' },    { status: 400 });
  if (subject.trim().length > 200)  return NextResponse.json({ error: 'Subject too long' }, { status: 400 });
  if (message.trim().length > 5000) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  await pool.query(
    `INSERT INTO contact_messages (name, email, subject, message)
     VALUES ($1, $2, $3, $4)`,
    [name.trim(), email.trim(), subject.trim(), message.trim()]
  );

  // Email the team. The message is already saved, so a mail failure is logged, not shown.
  try {
    await sendContactNotification({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() });
  } catch (err) {
    console.error('contact email failed:', err);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
