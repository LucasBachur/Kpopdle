const {
  pool,
  getShowById,
  getPendingShows,
  markShowResolved,
  getShowMultipliers,
  getShowEntry,
  insertShowEntry,
  updateShowEntryRankReward,
  getGachaConfig,
} = require('../db');

// ── T034: Score calculation ───────────────────────────────────────────────────

/*
 * baseScore  = avg(slot currentStat) × size_bonus_multiplier(N)
 * finalScore = baseScore × show_multipliers × random_factor
 * All tuning constants from gacha_config.
 */
async function calculateScore(lineupSlots, multipliers, config) {
  if (!lineupSlots.length) return { baseScore: 0, finalScore: 0 };

  const size = lineupSlots.length;
  const avgStat = lineupSlots.reduce((sum, s) => sum + s.currentStat, 0) / size;

  const sizeBonusPerSlot = config.size_bonus_per_slot ?? 0.02;
  const sizeMultiplier = 1 + (size - 1) * sizeBonusPerSlot;

  const baseScore = Math.round(avgStat * sizeMultiplier);

  let score = baseScore;
  for (const mult of multipliers) {
    if (isMultiplierApplicable(mult, lineupSlots)) {
      score *= mult.multiplierValue;
    }
  }

  const randomRange = config.random_range ?? 0.10;
  const randomFactor = 1 + (Math.random() - 0.5) * randomRange;
  const finalScore = Math.round(score * randomFactor);

  return { baseScore, finalScore };
}

// ── T035: Multiplier applicability ───────────────────────────────────────────

function isMultiplierApplicable(multiplier, lineupSlots) {
  const type = multiplier.appliesToType;
  const val = multiplier.appliesToValue?.toLowerCase();

  switch (type) {
    case 'role':
      return lineupSlots.some(s =>
        Array.isArray(s.roles) && s.roles.map(r => r.toLowerCase()).includes(val)
      );
    case 'company':
      return lineupSlots.some(s => s.company?.toLowerCase() === val);
    case 'same_group': {
      const groups = new Set(lineupSlots.map(s => s.group));
      return groups.size === 1;
    }
    case 'soloist_only':
      return lineupSlots.every(s => s.groupType === 'Soloist');
    default:
      return false;
  }
}

// ── T036+T038: resolveShow — idempotent show resolution ──────────────────────

async function resolveShow(showId) {
  const show = await getShowById(showId);
  if (!show) throw new Error(`Show ${showId} not found`);

  // T038: Idempotency guard
  if (show.resolutionStatus === 'resolved') {
    console.log(`Show ${showId} already resolved, skipping.`);
    return;
  }

  const config = await getGachaConfig();
  const multipliers = await getShowMultipliers(showId);

  const { rows: lineupRows } = await pool.query(
    `SELECT l.id AS "lineupId", l.user_id AS "userId", l.song_id AS "songId"
     FROM lineups l
     WHERE l.gender_category = $1 AND l.is_valid = TRUE`,
    [show.genderCategory]
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const lineup of lineupRows) {
      const existing = await getShowEntry(showId, lineup.userId);
      if (existing) continue;

      const { rows: slots } = await pool.query(
        `SELECT ls.slot_position AS "slotPosition",
                pc.current_stat AS "currentStat",
                i.name AS "idolName", i."group", i.group_type AS "groupType",
                i.company, i.roles
         FROM lineup_slots ls
         JOIN player_cards pc ON pc.id = ls.player_card_id
         JOIN card_definitions cd ON cd.id = pc.card_def_id
         JOIN idols i ON i.id = cd.idol_id
         WHERE ls.lineup_id = $1
         ORDER BY ls.slot_position`,
        [lineup.lineupId]
      );

      if (!slots.length) continue;

      const { baseScore, finalScore } = await calculateScore(slots, multipliers, config);
      await insertShowEntry(
        showId, lineup.userId, lineup.songId,
        baseScore, finalScore, slots, client
      );
    }

    await assignRanksAndRewards(showId, show.genderCategory, client);
    await markShowResolved(showId, client);
    await client.query('COMMIT');
    console.log(`Show ${showId} resolved successfully.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Error resolving show ${showId}:`, err);
    throw err;
  } finally {
    client.release();
  }
}

// ── T037: Rank assignment + reward distribution ───────────────────────────────

async function assignRanksAndRewards(showId, genderCategory, client) {
  const db = client || pool;
  const currencyCol = genderCategory === 'bg' ? 'bg_currency' : 'gg_currency';

  const { rows: entries } = await db.query(
    `SELECT id, user_id AS "userId", final_score AS "finalScore"
     FROM show_entries WHERE show_id = $1 ORDER BY final_score DESC`,
    [showId]
  );

  const total = entries.length;
  if (!total) return;

  for (let i = 0; i < entries.length; i++) {
    const rank = i + 1;
    const percentile = rank / total;
    let rewardRarity;
    if (percentile <= 0.10) rewardRarity = 'ultra_rare';
    else if (percentile <= 0.50) rewardRarity = 'super_rare';
    else rewardRarity = 'rare';

    await updateShowEntryRankReward(entries[i].id, rank, rewardRarity, client);
    await db.query(
      `UPDATE users SET ${currencyCol} = ${currencyCol} + 1 WHERE id = $1`,
      [entries[i].userId]
    );
  }
}

async function resolveAllPendingShows() {
  const pending = await getPendingShows();
  for (const show of pending) {
    try {
      await resolveShow(show.id);
    } catch (err) {
      console.error(`Failed to resolve show ${show.id}:`, err);
    }
  }
}

module.exports = { calculateScore, resolveShow, resolveAllPendingShows };
