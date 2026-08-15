import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const { rows } = await pool.query(
    `SELECT
       b.id, b.reference, b.short_name, b.full_name,
       bt.name                    AS bill_type,
       m.parliamentary_name       AS sponsor_name,
       m.preferred_name           AS sponsor_preferred,
       b.third_party_organisation,
       latest_stage.stage_name    AS current_stage,
       latest_stage.stage_date    AS latest_stage_date,
       sbd.resolution_id
     FROM sp_bills b
     LEFT JOIN sp_bill_types bt  ON bt.id = b.bill_type_id
     LEFT JOIN sp_members m      ON m.person_id = b.person_id
     LEFT JOIN LATERAL (
       SELECT bst.name AS stage_name, bs.stage_date
       FROM sp_bill_stages bs
       JOIN sp_bill_stage_types bst ON bst.id = bs.bill_stage_type_id
       WHERE bs.bill_id = b.id
       ORDER BY bs.stage_date DESC NULLS LAST
       LIMIT 1
     ) latest_stage ON true
     LEFT JOIN LATERAL (
       SELECT resolution_id FROM sp_bill_debates WHERE sp_bill_id = b.id LIMIT 1
     ) sbd ON true
     ORDER BY b.id DESC`
  );
  return NextResponse.json(rows);
}
