const {
  getPoolSize, getEligibleSongIds, getWeekPoolSongIds,
  weekPoolExists, insertWeekPoolRows, invalidateLineupsForGender, getMonday,
} = require('../db');

function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function selectPoolSongs({ eligible, lastWeek, targetSize }) {
  const lastWeekSet = new Set(lastWeek);
  const fresh = shuffle(eligible.filter(id => !lastWeekSet.has(id)));
  const reuse = shuffle(eligible.filter(id => lastWeekSet.has(id)));

  const selected = [];
  for (const id of fresh) {
    if (selected.length >= targetSize) break;
    selected.push(id);
  }
  const freshCount = selected.length;
  for (const id of reuse) {
    if (selected.length >= targetSize) break;
    selected.push(id);
  }
  const reusedCount = selected.length - freshCount;

  return {
    selected,
    freshCount,
    reusedCount,
    underTarget: eligible.length < targetSize,
  };
}

async function ensureWeeklyPool(weekStart, genderCategory) {
  const targetSize = await getPoolSize();

  if (await weekPoolExists(weekStart, genderCategory)) {
    const existing = await getWeekPoolSongIds(weekStart, genderCategory);
    return {
      weekStartDate: weekStart,
      genderCategory,
      created: false,
      targetSize,
      selected: existing,
      freshCount: 0,
      reusedCount: 0,
      underTarget: false,
    };
  }

  const eligible = await getEligibleSongIds(genderCategory);
  if (eligible.length === 0) {
    return {
      weekStartDate: weekStart,
      genderCategory,
      created: false,
      targetSize,
      selected: [],
      freshCount: 0,
      reusedCount: 0,
      underTarget: false,
      noEligibleSongs: true,
    };
  }

  // Previous ART Monday: subtract 7 days from weekStart (as UTC noon) and re-anchor
  const weekStartDate = new Date(weekStart + 'T12:00:00Z');
  weekStartDate.setUTCDate(weekStartDate.getUTCDate() - 7);
  const prevWeek = getMonday(weekStartDate);
  const lastWeek = await getWeekPoolSongIds(prevWeek, genderCategory);

  const { selected, freshCount, reusedCount, underTarget } = selectPoolSongs({
    eligible, lastWeek, targetSize,
  });

  await insertWeekPoolRows(weekStart, genderCategory, selected);

  return {
    weekStartDate: weekStart,
    genderCategory,
    created: true,
    targetSize,
    selected,
    freshCount,
    reusedCount,
    underTarget,
  };
}

async function invalidateStaleLineups(weekStart, genderCategory) {
  const poolSongIds = await getWeekPoolSongIds(weekStart, genderCategory);
  if (poolSongIds.length === 0) return 0;
  return invalidateLineupsForGender(genderCategory, poolSongIds);
}

module.exports = { shuffle, selectPoolSongs, ensureWeeklyPool, invalidateStaleLineups };
