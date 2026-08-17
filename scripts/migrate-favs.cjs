// Run with: node scripts/migrate-favs.cjs
// Must be run from /home/david/debate-report with NODE_ENV=production
const path = require('path');
const fs = require('fs');

// Read env file
const envPath = path.join(__dirname, '..', '.env.production.local');
const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
for (const line of envLines) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`
  CREATE TABLE IF NOT EXISTS proposal_favs (
    user_id text NOT NULL,
    proposal_id int NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, proposal_id)
  );
  CREATE TABLE IF NOT EXISTS nsp_principle_favs (
    user_id text NOT NULL,
    principle_id int NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, principle_id)
  );
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS description text;
  CREATE TABLE IF NOT EXISTS customer_members (
    customer_id int NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id text NOT NULL,
    joined_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (customer_id, user_id)
  );
`).then(() => {
  console.log('Migration complete.');
  pool.end();
}).catch(err => {
  console.error('Migration failed:', err.message);
  pool.end();
  process.exit(1);
});
