import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);

// Public endpoint — returns only non-sensitive display info
export async function GET() {
  try {
    const { rows: [c] } = await pool.query(
      `SELECT name FROM customers WHERE id = $1`,
      [TENANT_ID]
    );
    return NextResponse.json({ name: c?.name ?? null });
  } catch {
    return NextResponse.json({ name: null });
  }
}
