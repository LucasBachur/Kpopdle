/**
 * Additive migration for the annual Ultra-Rare ticket grant.
 * Creates two new tables; alters nothing existing. Idempotent.
 * Run once: node backend/migrate-ur-grant.js
 *
 *   ur_grant_dates — operator-configured (month, day) grant dates.
 *   ur_grant_log   — one row per calendar date actually granted (idempotency marker).
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ur_grant_dates (
        month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
        day   SMALLINT NOT NULL CHECK (day BETWEEN 1 AND 31),
        UNIQUE (month, day)
      )
    `);
    console.log('  ✓ ur_grant_dates ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ur_grant_log (
        grant_date DATE PRIMARY KEY,
        granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('  ✓ ur_grant_log ready');

    console.log('\nDone — UR grant tables migrated (additive, idempotent).');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });
