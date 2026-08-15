import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const billId = parseInt(id, 10);
  if (isNaN(billId)) return NextResponse.json({ error: 'Invalid bill id' }, { status: 400 });

  const [billRes, stagesRes, debateRes] = await Promise.all([
    pool.query(
      `SELECT b.id, b.reference, b.short_name, b.full_name,
              bt.name AS bill_type,
              m.person_id AS sponsor_id,
              m.parliamentary_name AS sponsor_name,
              m.preferred_name     AS sponsor_preferred,
              m.photo_url          AS sponsor_photo,
              b.third_party_organisation,
              -- Current party of sponsor
              (SELECT p.preferred_name
               FROM sp_member_parties mp
               JOIN sp_parties p ON p.id = mp.party_id
               WHERE mp.person_id = m.person_id
               ORDER BY mp.valid_from DESC NULLS LAST
               LIMIT 1) AS sponsor_party
       FROM sp_bills b
       LEFT JOIN sp_bill_types bt ON bt.id = b.bill_type_id
       LEFT JOIN sp_members m     ON m.person_id = b.person_id
       WHERE b.id = $1`,
      [billId]
    ),
    pool.query(
      `SELECT bs.id, bs.stage_date, bst.name AS stage_name, bst.sequence
       FROM sp_bill_stages bs
       JOIN sp_bill_stage_types bst ON bst.id = bs.bill_stage_type_id
       WHERE bs.bill_id = $1
       ORDER BY bs.stage_date ASC NULLS LAST`,
      [billId]
    ),
    pool.query(
      `SELECT sbd.resolution_id, s.stat_title
       FROM sp_bill_debates sbd
       JOIN statements s ON s.id = sbd.resolution_id
       WHERE sbd.sp_bill_id = $1`,
      [billId]
    ),
  ]);

  if (!billRes.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    bill: billRes.rows[0],
    stages: stagesRes.rows,
    debates: debateRes.rows,
  });
}
