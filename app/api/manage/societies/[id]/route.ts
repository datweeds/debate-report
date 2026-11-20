import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { reencryptSociety } from '@/lib/societyRekey';
import { moderatedSociety } from '@/lib/societies';
import { isUnlocked } from '@/lib/masterKey';
import { cleanFeatures } from '@/lib/features';
import { slugAvailable, slugProblem } from '@/lib/societyRef';
import { sealedSection } from '@/lib/sealed/server';

type Params = { params: Promise<{ id: string }> };

// GET — everything a moderator manages for one Society.
export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await moderatedSociety(req, params);
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [{ rows: [society] }, { rows: members }, { rows: requests }, { rows: invites }] = await Promise.all([
    pool.query(
      `SELECT id, name, visibility, hero_text, hero_image, description, contact_email, subdomain, is_default, disabled_sections, allow_sealed, status, is_demo
       FROM customers WHERE id = $1`, [ctx.id]),
    pool.query(
      `SELECT m.user_id, m.joined_at, u.user_handle, u.user_full_name,
              EXISTS (SELECT 1 FROM customer_roles r WHERE r.tenant_id = m.customer_id AND r.user_id = m.user_id AND r.role = 'customer_admin') AS is_moderator
       FROM customer_members m LEFT JOIN users u ON u.id::text = m.user_id
       WHERE m.customer_id = $1 ORDER BY is_moderator DESC, u.user_handle`, [ctx.id]),
    pool.query(
      `SELECT j.id, j.user_id, j.message, j.created_at, u.user_handle, u.user_full_name
       FROM society_join_requests j LEFT JOIN users u ON u.id::text = j.user_id
       WHERE j.customer_id = $1 AND j.status = 'pending' ORDER BY j.created_at`, [ctx.id]),
    pool.query(
      `SELECT id, label, created_at, expires_at, revoked_at, use_count, last_used_at
       FROM society_invites WHERE customer_id = $1 ORDER BY created_at DESC`, [ctx.id]),
  ]);
  return NextResponse.json({ society, members, requests, invites, me: ctx.session.sub });
}

// PATCH { name?, visibility?, hero_text?, description?, allow_sealed? }
export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await moderatedSociety(req, params);
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const sets: string[] = [];
  const values: unknown[] = [];
  const set = (col: string, v: unknown) => { values.push(v); sets.push(`${col} = $${values.length}`); };

  if (typeof body.name === 'string') {
    if (body.name.trim().length < 3) return NextResponse.json({ error: 'Name must be at least 3 characters' }, { status: 400 });
    set('name', body.name.trim().slice(0, 120));
  }
  if (['public', 'apply', 'invite'].includes(body.visibility)) {
    set('visibility', body.visibility);
    // Only a public Society can be the site default
    if (body.visibility !== 'public') sets.push('is_default = false');
  }
  if (typeof body.hero_text === 'string') set('hero_text', body.hero_text.trim().slice(0, 300) || null);
  if (typeof body.description === 'string') set('description', body.description.trim() || null);
  if (typeof body.contact_email === 'string') {
    const e = body.contact_email.trim();
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return NextResponse.json({ error: 'Enter a valid contact email, or leave it blank' }, { status: 400 });
    set('contact_email', e || null);
  }
  if (Array.isArray(body.disabled_sections)) set('disabled_sections', cleanFeatures(body.disabled_sections));
  // Members may create Sealed (end-to-end encrypted) items
  if (typeof body.allow_sealed === 'boolean') set('allow_sealed', body.allow_sealed);
  if (typeof body.slug === 'string') {
    const slug = body.slug.trim().toLowerCase();
    const problem = slugProblem(slug);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    if (!(await slugAvailable(slug, ctx.id))) return NextResponse.json({ error: 'That web address is already taken' }, { status: 409 });
    set('subdomain', slug);
  }
  if (!sets.length) return NextResponse.json({ ok: true });

  const { rows: [before] } = await pool.query('SELECT visibility, is_demo FROM customers WHERE id = $1', [ctx.id]);
  if (before?.is_demo && body.visibility && body.visibility !== 'public') {
    return NextResponse.json({ error: 'This is the demo Society, so it stays public. Ask a Sys Admin to choose another demo first.' }, { status: 400 });
  }
  // Switching public ↔ private re-encrypts its content, which needs the master key
  if (body.visibility && (body.visibility === 'public') !== (before?.visibility === 'public') && !isUnlocked()) {
    return NextResponse.json({ error: 'Privacy can’t be changed while private Societies are locked. Please try again later.' }, { status: 503 });
  }
  // Sealed debates are only for private Societies (public debates are for everyone to read)
  if (body.visibility === 'public' && before?.visibility !== 'public' && await sealedSection(ctx.id, 'debates')) {
    return NextResponse.json({ error: 'This Society’s debates are sealed. Unseal them (on the Debate tab) before making the Society public.' }, { status: 409 });
  }
  values.push(ctx.id);
  await pool.query(`UPDATE customers SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values);
  // Public ↔ private: encrypt (or decrypt) the Society's stored content to match, in the background
  const wasPublic = before?.visibility === 'public';
  if (body.visibility && (body.visibility === 'public') !== wasPublic) {
    void reencryptSociety(ctx.id)
      .then(n => console.log(`[privacy] society ${ctx.id} now ${body.visibility}: ${n} items re-encrypted`))
      .catch(err => console.error('[privacy] reencrypt', err));
  }
  return NextResponse.json({ ok: true });
}
