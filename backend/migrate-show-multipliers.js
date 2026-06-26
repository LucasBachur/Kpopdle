const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('Missing DATABASE_URL'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS show_schedule_multipliers (
        id               SERIAL PRIMARY KEY,
        schedule_id      INTEGER NOT NULL REFERENCES show_schedules(id) ON DELETE CASCADE,
        label            TEXT NOT NULL,
        multiplier_value NUMERIC NOT NULL CHECK (multiplier_value > 0),
        applies_to_type  TEXT NOT NULL
                           CHECK (applies_to_type IN ('role', 'company', 'same_group')),
        applies_to_value TEXT
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS show_schedule_multipliers_uniq
        ON show_schedule_multipliers(schedule_id, applies_to_type, COALESCE(applies_to_value, ''))
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS show_multipliers_uniq
        ON show_multipliers(show_id, applies_to_type, COALESCE(applies_to_value, ''))
    `);

    await client.query('COMMIT');
    console.log('Migration complete — show_schedule_multipliers ready.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
