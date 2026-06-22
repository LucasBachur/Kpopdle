/**
 * Inserts GG show_schedules for the five main Korean music shows.
 * All times are in ART (America/Argentina/Buenos_Aires, UTC-3).
 * Run once: node backend/seed-shows.js
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const GG_SHOWS = [
  // day_of_week: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  { dayOfWeek: 3, showName: 'Show Champion',  deadlineTime: '12:45:00', showTime: '13:00:00', broadcaster: 'MBC Music' },
  { dayOfWeek: 4, showName: 'M Countdown',    deadlineTime: '17:45:00', showTime: '18:00:00', broadcaster: 'Mnet'      },
  { dayOfWeek: 5, showName: 'Music Bank',     deadlineTime: '17:45:00', showTime: '18:00:00', broadcaster: 'KBS'       },
  { dayOfWeek: 6, showName: 'Music Core',     deadlineTime: '13:45:00', showTime: '14:00:00', broadcaster: 'KBS'       },
  { dayOfWeek: 0, showName: 'Inkigayo',       deadlineTime: '11:45:00', showTime: '12:00:00', broadcaster: 'SBS'       },
];

async function seed() {
  const client = await pool.connect();
  try {
    let inserted = 0;
    for (const show of GG_SHOWS) {
      const { rowCount } = await client.query(
        `INSERT INTO show_schedules
           (gender_category, day_of_week, show_name, deadline_time, show_time, timezone)
         VALUES ('gg', $1, $2, $3, $4, 'America/Argentina/Buenos_Aires')
         ON CONFLICT DO NOTHING`,
        [show.dayOfWeek, show.showName, show.deadlineTime, show.showTime]
      );
      if (rowCount) {
        console.log(`  + ${show.showName} (day ${show.dayOfWeek})`);
        inserted++;
      } else {
        console.log(`  = ${show.showName} already exists`);
      }
    }
    console.log(`\nDone — ${inserted} rows inserted, ${GG_SHOWS.length - inserted} already present.`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
