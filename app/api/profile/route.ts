import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT u.id, u.user_handle, u.user_full_name, u.user_bio, u.bio_public,
            u.email, u.newsletter, u.user_tier,
            COALESCE(
              json_agg(
                json_build_object(
                  'id',           p.id,
                  'deviceType',   p.device_type,
                  'backedUp',     p.backed_up,
                  'transports',   p.transports,
                  'createdAt',    p.created_at,
                  'lastUsedAt',   p.last_used_at
                ) ORDER BY p.created_at
              ) FILTER (WHERE p.id IS NOT NULL),
              '[]'
            ) AS passkeys
     FROM users u
     LEFT JOIN passkeys p ON p.user_id = u.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [session.sub]
  );

  if (!rows.length) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json();
  const { displayName, bio, bioPublic, email, newsletter } = body;

  // Validate bio length
  if (bio !== undefined && bio.trim().length > 200) {
    return NextResponse.json({ error: 'Bio must be 200 characters or fewer' }, { status: 400 });
  }
  // Validate email uniqueness if being set
  if (email !== undefined && email.trim()) {
    const existing = await pool.query(
      `SELECT id FROM users WHERE email = $1 AND id != $2`,
      [email.trim(), session.sub]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Email already in use by another account' }, { status: 409 });
    }
  }

  await pool.query(
    `UPDATE users SET
       user_full_name = COALESCE($1, user_full_name),
       user_bio       = $2,
       bio_public     = COALESCE($3, bio_public),
       email          = $4,
       newsletter     = COALESCE($5, newsletter),
       updated_at     = NOW()
     WHERE id = $6`,
    [
      displayName?.trim() || null,
      bio?.trim() ?? null,
      bioPublic !== undefined ? bioPublic : null,
      email?.trim() || null,
      newsletter !== undefined ? newsletter : null,
      session.sub,
    ]
  );

  return NextResponse.json({ ok: true });
}
