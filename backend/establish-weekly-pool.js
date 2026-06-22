require('dotenv').config();
const { getMonday, pool } = require('./db');
const { ensureWeeklyPool, invalidateStaleLineups } = require('./services/weeklyPoolService');

const gender = process.argv[2] || 'gg';
if (!['gg', 'bg'].includes(gender)) {
  console.error('Usage: node backend/establish-weekly-pool.js [gg|bg]');
  pool.end();
  process.exit(1);
}

async function main() {
  const weekStart = getMonday();
  const result = await ensureWeeklyPool(weekStart, gender);

  if (result.noEligibleSongs) {
    console.log(`[${gender.toUpperCase()}] No eligible songs — pool not created. Existing pool (if any) preserved.`);
  } else if (result.created) {
    console.log(`[${gender.toUpperCase()}] Pool CREATED for week ${result.weekStartDate}`);
    console.log(`  Target size: ${result.targetSize}`);
    console.log(`  Selected: ${result.selected.length} (fresh: ${result.freshCount}, reused: ${result.reusedCount})`);
    if (result.underTarget) {
      console.log(`  WARNING: Under target — only ${result.selected.length} of ${result.targetSize} eligible songs available`);
    }
  } else {
    console.log(`[${gender.toUpperCase()}] Pool already present for week ${result.weekStartDate} — no changes.`);
    console.log(`  Songs in pool: ${result.selected.length}`);
  }

  const invalidated = await invalidateStaleLineups(weekStart, gender);
  if (invalidated > 0) {
    console.log(`  Lineups invalidated: ${invalidated}`);
  }
}

main()
  .then(() => pool.end())
  .catch(err => { console.error('Error:', err); pool.end(); process.exit(1); });
