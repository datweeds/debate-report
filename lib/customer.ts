import { headers } from 'next/headers';
import pool from '@/lib/db';

export type Customer = {
  id: number;
  name: string;
  subdomain: string;
  status: string;
  hero_image: string | null;
  hero_text: string | null;
  contact_email: string | null;
  platform_contact_email: string | null;
};

/** Returns the current customer based on the x-customer-subdomain header set by middleware. */
export async function getCustomer(): Promise<Customer | null> {
  const h = await headers();
  const subdomain = h.get('x-customer-subdomain');
  if (!subdomain) return null;

  try {
    const { rows: [customer] } = await pool.query<Customer>(
      `SELECT id, name, subdomain, status, hero_image, hero_text, contact_email, platform_contact_email
       FROM customers WHERE subdomain = $1`,
      [subdomain]
    );
    return customer ?? null;
  } catch {
    return null;
  }
}

/** Returns the customer for the current TENANT_ID env var (for non-subdomain deployments). */
export async function getTenantCustomer(): Promise<Customer | null> {
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) return null;
  try {
    const { rows: [customer] } = await pool.query<Customer>(
      `SELECT id, name, subdomain, status, hero_image, hero_text, contact_email, platform_contact_email
       FROM customers WHERE id = $1`,
      [parseInt(tenantId, 10)]
    );
    return customer ?? null;
  } catch {
    return null;
  }
}
