import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import {
  hashPassword, hashAccessCode, generateAccessCode,
  createToken, sessionCookie,
} from '@/lib/auth';

const DEBATER_TIERS = new Set(['debater', 'moderator', 'sysadmin']);

export async function POST(req: NextRequest) {
  const { userHandle, email, password, tier, plan, incognito, inviteToken } = await req.json();

  if (!userHandle || userHandle.trim().length < 3) {
    return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(userHandle)) {
    return NextResponse.json({ error: 'Username may only contain letters, numbers, _ and -' }, { status: 400 });
  }
  if (!incognito && !password) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }
  if (!['follower', 'voter', 'debater', 'moderator'].includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id FROM users
       WHERE user_handle = $1 OR (email IS NOT NULL AND email = $2)`,
      [userHandle.trim(), email?.trim() || null]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Username or email already taken' }, { status: 409 });
    }

    let passwordHash: string | null = null;
    let accessCodeHash: string | null = null;
    let plainCode: string | null = null;

    if (incognito) {
      plainCode = generateAccessCode();
      accessCodeHash = await hashAccessCode(plainCode);
    } else {
      passwordHash = await hashPassword(password);
    }

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO users
         (user_handle, email, password_hash, access_code, user_tier, user_plan, terms_agreed, date_activated)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
       RETURNING id, user_handle, is_sys_admin, user_tier, user_plan`,
      [
        userHandle.trim(),
        incognito ? null : (email?.trim() || null),
        passwordHash,
        accessCodeHash,
        tier,
        plan || 'free',
      ]
    );
    const user = result.rows[0];

    // Auto-create system-allocated private forum for debater-tier users
    if (DEBATER_TIERS.has(user.user_tier)) {
      const forumTitle = `${user.user_handle}'s Forum`;
      const { rows: [forum] } = await client.query(
        `INSERT INTO debate_forums
           (created_by, forum_owner, forum_title, forum_type, forum_visibility, forum_status, is_system_forum)
         VALUES ($1, $1, $2, 'private', 'invite', 'active', TRUE)
         RETURNING id`,
        [user.id, forumTitle]
      );
      // Add owner as active member of their own forum
      await client.query(
        `INSERT INTO forum_members (forum_id, user_id, member_role, member_status)
         VALUES ($1, $2, 'debater', 'active')`,
        [forum.id, user.id]
      );
    }

    // Process invite token if present
    if (inviteToken) {
      const { rows: [inv] } = await client.query(
        `SELECT id, forum_id FROM invitations
         WHERE token = $1 AND invitation_status = 'open'`,
        [inviteToken]
      );
      if (inv) {
        await client.query(
          `UPDATE invitations SET invitation_status = 'accepted', updated_at = NOW() WHERE id = $1`,
          [inv.id]
        );
        await client.query(
          `INSERT INTO forum_members (forum_id, user_id, member_role, member_status)
           VALUES ($1, $2, 'debater', 'active')
           ON CONFLICT (forum_id, user_id) DO UPDATE SET member_status = 'active', updated_at = NOW()`,
          [inv.forum_id, user.id]
        );
      }
    }

    await client.query('COMMIT');

    const token = await createToken({
      sub: user.id,
      handle: user.user_handle,
      isSysAdmin:    user.is_sys_admin ?? false,
      isScotparlMod: false,
      tier: user.user_tier,
      plan: user.user_plan ?? 'free',
      customerAdminTenants: [],
      topicOwnerTenants:    [],
    });

    const res = NextResponse.json({ ok: true, accessCode: plainCode });
    res.cookies.set(sessionCookie(token));
    return res;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Registration error:', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  } finally {
    client.release();
  }
}
