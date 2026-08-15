import { Pool, QueryResult, QueryResultRow } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const TENANT_ID = process.env.TENANT_ID;

function getTenantId(): number {
  if (!TENANT_ID) throw new Error('TENANT_ID environment variable is not set');
  const id = parseInt(TENANT_ID, 10);
  if (isNaN(id)) throw new Error('TENANT_ID must be a valid integer');
  return id;
}

/** Tenant-scoped query — sets RLS session variable before executing */
export async function tq<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  values?: unknown[]
): Promise<QueryResult<T>> {
  const tenantId = getTenantId();
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
