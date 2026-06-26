const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// showName is matched as a case-insensitive substring against show_schedules.show_name
const TEMPLATES = [
  { showName: 'Show Champion', appliesToType: 'role',       appliesToValue: 'vocalist',         label: '+Vocalist',      multiplierValue: 1.15 },
  { showName: 'M Countdown',   appliesToType: 'role',       appliesToValue: 'rapper',           label: '+Rapper',        multiplierValue: 1.15 },
  { showName: 'Music Bank',    appliesToType: 'role',       appliesToValue: 'dancer',           label: '+Dancer',        multiplierValue: 1.15 },
  { showName: 'Music Core',    appliesToType: 'company',    appliesToValue: 'SM Entertainment', label: '+SM Ent',        multiplierValue: 1.20 },
  { showName: 'Inkigayo',      appliesToType: 'same_group', appliesToValue: 'any',              label: '+Group Synergy', multiplierValue: 1.25 },
];

async function seed() {
  const client = await pool.connect();
  try {
    let inserted = 0;
    let alreadyPresent = 0;

    for (const t of TEMPLATES) {
      const { rows } = await client.query(
        `SELECT id, show_name AS "showName" FROM show_schedules
         WHERE show_name ILIKE $1 AND gender_category = 'gg'`,
        [`%${t.showName}%`]
      );
      if (!rows.length) {
        console.warn(`  ! Schedule not found matching "${t.showName}" — skipping`);
        continue;
      }

      for (const schedule of rows) {
        const { rowCount } = await client.query(
          `INSERT INTO show_schedule_multipliers
             (schedule_id, label, multiplier_value, applies_to_type, applies_to_value)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (schedule_id, applies_to_type, COALESCE(applies_to_value, '')) DO NOTHING`,
          [schedule.id, t.label, t.multiplierValue, t.appliesToType, t.appliesToValue]
        );

        if (rowCount) {
          console.log(`  + ${schedule.showName}: ${t.label}`);
          inserted++;
        } else {
          console.log(`  = ${schedule.showName}: ${t.label} already present`);
          alreadyPresent++;
        }
      }
    }

    console.log(`\nDone — ${inserted} inserted, ${alreadyPresent} already present.`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
