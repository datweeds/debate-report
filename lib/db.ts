import { Pool, QueryResult, QueryResultRow } from 'pg';
import { cookies } from 'next/headers';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const TENANT_ID = process.env.TENANT_ID;

// "Society" is the user-facing term for a customer/tenant; the cookie, table
// and column names stay as they already were (customers, tenant_id,
// customer_id) to avoid a risky rename across the ~60 files that reference
// them — only display copy says "Society".
export const SOCIETY_COOKIE = 'nv_society_id';

// The current society: a cookie set by /api/customer/switch (validated there —
// public, or a member, or sysadmin, at selection time) overrides the sysadmin-
// configured default. A plain existence check here (not re-checking is_public)
// keeps this cheap, since tq() calls this on every tenant-scoped query.
export async function getCurrentTenantId(): Promise<number> {
  try {
    const store = await cookies();
    const raw = store.get(SOCIETY_COOKIE)?.value;
    const id = raw ? parseInt(raw, 10) : NaN;
    if (!isNaN(id)) {
      const { rows } = await pool.query('SELECT 1 FROM customers WHERE id = $1', [id]);
      if (rows.length) return id;
    }
  } catch {
    // cookies() throws outside a request context (e.g. a script) — fall through.
  }
  try {
    const { rows } = await pool.query('SELECT id FROM customers WHERE is_default = true LIMIT 1');
    if (rows[0]) return rows[0].id;
  } catch {
    // ignore — fall through to the legacy env var as a last resort
  }
  if (TENANT_ID) {
    const id = parseInt(TENANT_ID, 10);
    if (!isNaN(id)) return id;
  }
  return 1;
}

/** Tenant-scoped query — sets RLS session variable before executing */
export async function tq<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  values?: unknown[]
): Promise<QueryResult<T>> {
  const tenantId = await getCurrentTenantId();
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = ${tenantId}`);
    return await client.query<T>(sql, values);
  } finally {
    client.release();
  }
}

/** Platform/admin query — bypasses RLS (sees all tenants) */
export async function pq<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  values?: unknown[]
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = 'admin'`);
    return await client.query<T>(sql, values);
  } finally {
    client.release();
  }
}

export default pool;
