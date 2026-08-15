import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personId = parseInt(id, 10);
  if (isNaN(personId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [memberRes, partiesRes, billsRes] = await Promise.all([
    pool.query(
      `SELECT person_id, parliamentary_name, preferred_name, photo_url, is_current, gender_type_id, notes
       FROM sp_members WHERE person_id = $1`,
      [personId]
    ),
    pool.query(
      `SELECT mp.id, mp.valid_from, mp.valid_until,
              p.preferred_name AS party_name, p.abbreviation AS party_abbr
       FROM sp_member_parties mp
       JOIN sp_parties p ON p.id = mp.party_id
       WHERE mp.person_id = $1
       ORDER BY mp.valid_from DESC NULLS LAST`,
      [personId]
    ),
    pool.query(
      `SELECT b.id, b.reference, b.short_name, b.full_name,
              bt.name AS bill_type,
              (SELECT bst.name
               FROM sp_bill_stages bs
               JOIN sp_bill_stage_types bst ON bst.id = bs.bill_stage_type_id
               WHERE bs.bill_id = b.id
               ORDER BY bs.stage_date DESC NULLS LAST
               LIMIT 1) AS current_stage
       FROM sp_bills b
       LEFT JOIN sp_bill_types bt ON bt.id = b.bill_type_id
       WHERE b.person_id = $1
       ORDER BY b.id DESC`,
      [personId]
    ),
  ]);

  if (!memberRes.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    member: memberRes.rows[0],
    parties: partiesRes.rows,
    bills: billsRes.rows,
  });
}
