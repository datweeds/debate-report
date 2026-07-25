import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const { rows } = await pool.query(
    `SELECT s.id, s.stat_title, s.subject_area, s.forum_visibility,
            s.image_path, s.created_at,
            u.user_handle AS creator_handle,
            COUNT(c.id)::int AS child_count
     FROM   statements s
     LEFT   JOIN users u ON u.id = s.created_by
     LEFT   JOIN statements c ON c.resolution_id = s.id
     WHERE  s.stat_type = 'resolution' AND s.forum_visibility = 'public'
     GROUP  BY s.id, u.user_handle
     ORDER  BY s.created_at DESC`
  );
  return NextResponse.json(rows);
}
