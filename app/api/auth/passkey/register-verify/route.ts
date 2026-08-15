import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import pool from '@/lib/db';
import {
  verifyChallengeToken, clearChallengeCookie,
  sessionCookie, createToken,
  generateAccessCode, hashAccessCode,
  CHALLENGE_COOKIE,
} from '@/lib/auth';

const RP_ID    = process.env.WEBAUTHN_RP_ID    || 'debate.report';
const ORIGINS  = (process.env.WEBAUTHN_ORIGIN  || 'https://debate.report').split(',').map(s => s.trim());

export async function POST(req: NextRequest) {
  const chalToken = req.cookies.get(CHALLENGE_COOKIE)?.value;
  if (!chalToken) return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });

  const chal = await verifyChallengeToken(chalToken);
  if (!chal) return NextResponse.json({ error: 'Challenge expired or invalid' }, { status: 400 });

  const body = await req.json();

  let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
  try {
    verification = await verifyRegistrationResponse({
      response:          body,
      expectedChallenge: chal.challenge,
      expectedOrigin:    ORIGINS,
      expectedRPID:      RP_ID,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Passkey verification failed' }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const transports: string[] = credential.transports ?? body.response?.transports ?? [];

  // Generate recovery access code
  const plainCode   = generateAccessCode();
  const hashedCode  = await hashAccessCode(plainCode);

  const tier = chal.tier || 'follower';
  const DEBATER_TIERS = new Set(['debater', 'moderator', 'sysadmin']);

  // Atomically create user + passkey + system forum
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      `INSERT INTO users (id, user_handle, email, user_tier, user_plan, access_code, user_full_name, user_bio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_handle, is_sys_admin, user_tier, user_plan`,
      [
        chal.userId,
        chal.userHandle,
        chal.email || null,
        tier,
        chal.plan || 'free',
        hashedCode,
        chal.displayName || null,
        chal.bio || null,
      ]
    );
    const user = userRes.rows[0];

    await client.query(
      `INSERT INTO passkeys
         (user_id, credential_id, public_key, counter, device_type, backed_up, transports)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        chal.userId,
        credential.id,
        Buffer.from(credential.publicKey),
        credential.counter,
        credentialDeviceType ?? null,
        credentialBackedUp ?? false,
        transports,
      ]
    );

    // Auto-create system forum for debater-tier users
    if (DEBATER_TIERS.has(user.user_tier)) {
      const { rows: [forum] } = await client.query(
        `INSERT INTO debate_forums
           (created_by, forum_owner, forum_title, forum_type, forum_visibility, forum_status, is_system_forum)
         VALUES ($1, $1, $2, 'private', 'invite', 'active', TRUE)
         RETURNING id`,
        [user.id, `${user.user_handle}'s Forum`]
      );
      await client.query(
        `INSERT INTO forum_members (forum_id, user_id, member_role, member_status)
         VALUES ($1, $2, 'debater', 'active')`,
        [forum.id, user.id]
      );
    }

    // Process invite token if present
    if (chal.inviteToken) {
      const { rows: [inv] } = await client.query(
        `SELECT id, forum_id FROM invitations
         WHERE token = $1 AND invitation_status = 'open'`,
        [chal.inviteToken]
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
      sub:        user.id,
      handle:     user.user_handle,
      isSysAdmin:    user.is_sys_admin ?? false,
      isScotparlMod: user.is_scotparl_mod ?? false,
      tier:          user.user_tier,
      plan:          user.user_plan ?? 'free',
      customerAdminTenants: [],
      topicOwnerTenants:    [],
    });

    const res = NextResponse.json({ ok: true, accessCode: plainCode });
    res.cookies.set(sessionCookie(token));
    res.cookies.set(clearChallengeCookie());
    return res;
  } catch (err) {
    await client.query('ROLLBACK');
    // Duplicate handle/email race condition
    if ((err as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Username or email already taken' }, { status: 409 });
    }
    console.error('passkey register-verify error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
