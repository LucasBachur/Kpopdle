/**
 * Inserts default gacha_config rows.
 * All values are tunable in the DB without code changes.
 * Run once: node backend/seed-gacha-config.js
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DEFAULTS = [
  // Pull rates (standard banner pulls)
  ['rare_base_rate',         '0.85'],
  ['sr_base_rate',           '0.13'],
  ['ur_base_rate',           '0.02'],
  // Daily banner SR rate (lower; no UR on daily banner)
  ['daily_banner_sr_rate',   '0.03'],
  // Pity thresholds
  ['sr_pity_threshold',      '50'],
  ['ur_pity_threshold',      '100'],
  // Banner Rate Up share
  ['rate_up_percentage',     '0.75'],
  // Pull costs (in 💎)
  ['single_pull_cost',       '1'],
  ['multi_pull_count',       '10'],
  ['multi_pull_cost',        '9'],
  // Starter collection
  ['starter_pull_count',     '30'],
  // Scoring
  ['random_range',           '0.10'],
  ['size_bonus_per_slot',    '0.02'],
  ['max_lineup_size',        '9'],
  // Reward percentile thresholds (top X% get that rarity)
  ['reward_ur_percentile',   '0.10'],
  ['reward_sr_percentile',   '0.50'],
  // Weekly pool
  ['weekly_pool_size',       '25'],
  // Chemistry bonus cap
  ['chemistry_max_bonus',    '0.15'],
  // GG-only launch mode ('1' = Boy Group sealed off; '0' = BG permitted)
  ['gg_only_mode',           '1'],
];

async function seed() {
  const client = await pool.connect();
  try {
    let inserted = 0;
    for (const [key, value] of DEFAULTS) {
      const { rowCount } = await client.query(
        `INSERT INTO gacha_config (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING`,
        [key, value]
      );
      if (rowCount) {
        console.log(`  + ${key} = ${value}`);
        inserted++;
      } else {
        console.log(`  = ${key} already set`);
      }
    }
    console.log(`\nDone — ${inserted} rows inserted, ${DEFAULTS.length - inserted} already present.`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
