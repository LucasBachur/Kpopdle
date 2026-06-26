/**
 * Seeds the default annual UR grant date: Dec 31 (12, 31).
 * Operators add/remove rows to change grant dates with no code change.
 * Idempotent. Run once: node backend/seed-ur-grant-dates.js
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DEFAULTS = [
  [12, 31], // year-end grant
];

async function seed() {
  const client = await pool.connect();
  try {
    let inserted = 0;
    for (const [month, day] of DEFAULTS) {
      const { rowCount } = await client.query(
        `INSERT INTO ur_grant_dates (month, day)
         VALUES ($1, $2)
         ON CONFLICT (month, day) DO NOTHING`,
        [month, day]
      );
      if (rowCount) {
        console.log(`  + grant date ${month}-${day}`);
        inserted++;
      } else {
        console.log(`  = grant date ${month}-${day} already set`);
      }
    }
    console.log(`\nDone — ${inserted} inserted, ${DEFAULTS.length - inserted} already present.`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
