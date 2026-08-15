import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const { rows } = await pool.query(
    `SELECT
       m.person_id, m.parliamentary_name, m.preferred_name, m.photo_url, m.is_current,
       p.preferred_name                  AS party_name,
       p.abbreviation                    AS party_abbr,
       COUNT(DISTINCT b.id)::int         AS bills_sponsored
     FROM sp_members m
     LEFT JOIN LATERAL (
       SELECT mp.party_id
       FROM sp_member_parties mp
       WHERE mp.person_id = m.person_id
       ORDER BY mp.valid_from DESC NULLS LAST
       LIMIT 1
     ) latest_mp ON true
     LEFT JOIN sp_parties p ON p.id = latest_mp.party_id
     LEFT JOIN sp_bills   b ON b.person_id = m.person_id
     GROUP BY m.person_id, m.parliamentary_name, m.preferred_name,
              m.photo_url, m.is_current, p.preferred_name, p.abbreviation
     ORDER BY m.is_current DESC, m.parliamentary_name ASC`
  );
  return NextResponse.json(rows);
}
