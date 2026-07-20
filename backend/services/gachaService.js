const {
  pool,
  getGachaConfig,
  getBannerWithMembers,
  consumeBannerFreePulls,
  getDailyBanner,
  getDailyBannerCards,
  getPityCounter,
  setPityCounter,
  getActiveCardDefsByGender,
  getCardDefById,
} = require('../db');
const { addCardToCollection } = require('./collectionService');

const ART_TZ = 'America/Argentina/Buenos_Aires';

function todayART() {
  return new Date().toLocaleDateString('en-CA', { timeZone: ART_TZ });
}

// Midnight ART = 03:00 UTC (ART is UTC-3, no DST).
function nextMidnightART() {
  const [y, m, d] = todayART().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, 3, 0, 0)).toISOString();
}

const DAILY_PULL_COL = {
  gg: 'last_daily_pull_gg',
  bg: 'last_daily_pull_bg',
};

// ── claimDailyPull ────────────────────────────────────────────────────────────
// One free pull per day on the daily banner. Uses daily_banner_sr_rate; no UR.

async function claimDailyPull(userId, genderCategory) {
  const col = DAILY_PULL_COL[genderCategory];
  if (!col) throw new Error(`Unknown genderCategory: ${genderCategory}`);

  const { rows } = await pool.query(
    `SELECT ${col} AS "lastClaim" FROM users WHERE id = $1`,
    [userId]
  );
  const lastClaim = rows[0]?.lastClaim;
  if (lastClaim) {
    const claimedDate = new Date(lastClaim).toLocaleDateString('en-CA', { timeZone: ART_TZ });
    if (claimedDate === todayART()) {
      const err = new Error('Daily pull already claimed today');
      err.code = 'ALREADY_CLAIMED';
      throw err;
    }
  }

  const dailyBanner = await getDailyBanner(genderCategory);
  if (!dailyBanner) throw new Error('No daily banner configured');

  const dailyPool = await getDailyBannerCards(dailyBanner.id);
  if (!dailyPool.length) {
    const err = new Error('Daily banner card pool is not configured');
    err.code = 'POOL_NOT_CONFIGURED';
    throw err;
  }

  const cardDefId = dailyPool[Math.floor(Math.random() * dailyPool.length)];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await addCardToCollection(userId, cardDefId, client);
    const def = await getCardDefById(cardDefId);
    await client.query(`UPDATE users SET ${col} = NOW() WHERE id = $1`, [userId]);
    await client.query('COMMIT');

    return {
      card: {
        cardDefId,
        idolName: def?.idolName ?? 'Unknown',
        group: def?.group ?? '',
        rarity: def?.rarity ?? 'rare',
        artPath: def?.artPath ?? null,
        isRateUp: false,
        ...result,
      },
      nextClaimAt: nextMidnightART(),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── resolvePool ───────────────────────────────────────────────────────────────
// Picks a cardDefId from banner members matching `rarity`, applying rate-up by idol.
// isComeback: true when the banner has both SR and UR members.
//   - SR: rate-up boosts the selected idol's SR card.
//   - UR: guaranteed to return the selected idol's UR card (comeback mechanic).
// Milestone (UR-only): rate-up boosts the selected idol's UR card normally.
// Returns null when no banner members exist for the rarity (caller uses global pool).

function resolvePool(members, rarity, rateUpIdolId, isComeback, config) {
  const rarityMembers = members.filter(m => m.rarity === rarity);
  if (!rarityMembers.length) return null;

  // Comeback UR: guaranteed card for the selected idol.
  if (isComeback && rarity === 'ultra_rare') {
    const guaranteed = rarityMembers.find(m => m.idolId === rateUpIdolId);
    return guaranteed?.cardDefId
      ?? rarityMembers[Math.floor(Math.random() * rarityMembers.length)].cardDefId;
  }

  if (!rateUpIdolId || rarityMembers.length === 1) {
    return rarityMembers[Math.floor(Math.random() * rarityMembers.length)].cardDefId;
  }

  const rateUpMember = rarityMembers.find(m => m.idolId === rateUpIdolId);
  if (!rateUpMember) {
    console.warn(`[gacha] resolvePool: rateUpIdolId=${rateUpIdolId} has no ${rarity} card in banner pool; falling back to uniform distribution`);
    return rarityMembers[Math.floor(Math.random() * rarityMembers.length)].cardDefId;
  }

  const rateUpPct = config.rate_up_percentage ?? 0.75;
  const others = rarityMembers.filter(m => m.idolId !== rateUpIdolId);
  const otherEach = others.length > 0 ? (1 - rateUpPct) / others.length : 0;

  let r = Math.random();
  r -= rateUpPct;
  if (r <= 0) return rateUpMember.cardDefId;
  for (const m of others) {
    r -= otherEach;
    if (r <= 0) return m.cardDefId;
  }
  return others[others.length - 1]?.cardDefId ?? rateUpMember.cardDefId;
}

// ── pull ──────────────────────────────────────────────────────────────────────

async function pull(userId, bannerId, count, rateUpIdolId, genderCategory) {
  const config = await getGachaConfig();
  const banner = await getBannerWithMembers(bannerId);
  if (!banner) throw new Error('Banner not found');
  if (!banner.members?.length) throw new Error('Banner has no cards');

  // Comeback = has SR members; Milestone = UR-only members.
  const isComeback = banner.members.some(m => m.rarity === 'super_rare');

  const singleCost = config.single_pull_cost ?? 1;
  const multiCost  = config.multi_pull_cost  ?? 9;
  const multiCount = config.multi_pull_count  ?? 10;

  const currencyCol = genderCategory === 'bg' ? 'bg_currency' : 'gg_currency';

  const srThreshold = config.sr_pity_threshold ?? 50;
  const urThreshold = config.ur_pity_threshold ?? 100;
  const srRate = config.sr_base_rate ?? 0.13;
  const urRate = config.ur_base_rate ?? 0.02;

  let srPity = await getPityCounter(userId, genderCategory, 'super_rare');
  let urPity = await getPityCounter(userId, genderCategory, 'ultra_rare');

  const client = await pool.connect();
  const cards = [];
  let freeToUse = 0;
  let currencyCost = 0;

  try {
    await client.query('BEGIN');

    const { rows: fpRows } = await client.query(
      `SELECT free_pulls_remaining FROM banner_free_pulls WHERE user_id=$1 AND banner_id=$2 FOR UPDATE`,
      [userId, bannerId]
    );
    freeToUse = Math.min(count, fpRows[0]?.free_pulls_remaining ?? 0, 10);
    const paidCount = count - freeToUse;

    currencyCost = paidCount === 0 ? 0
      : paidCount === multiCount ? multiCost
      : paidCount * singleCost;

    if (paidCount > 0) {
      const { rows: uRows } = await client.query(
        `SELECT ${currencyCol} AS currency FROM users WHERE id = $1`,
        [userId]
      );
      if (!uRows.length) throw new Error('User not found');
      if (uRows[0].currency < currencyCost) {
        const err = new Error('Insufficient currency');
        err.code = 'INSUFFICIENT_CURRENCY';
        err.have = uRows[0].currency;
        err.need = currencyCost;
        throw err;
      }
    }

    if (freeToUse > 0) {
      await consumeBannerFreePulls(userId, bannerId, freeToUse, client);
    }
    if (paidCount > 0) {
      await client.query(
        `UPDATE users SET ${currencyCol} = ${currencyCol} - $1 WHERE id = $2`,
        [currencyCost, userId]
      );
    }

    for (let i = 0; i < count; i++) {
      let rarity;
      if (urPity >= urThreshold) {
        rarity = 'ultra_rare';
      } else if (srPity >= srThreshold) {
        rarity = 'super_rare';
      } else {
        const rand = Math.random();
        if (rand < urRate) rarity = 'ultra_rare';
        else if (rand < urRate + srRate) rarity = 'super_rare';
        else rarity = 'rare';
      }

      let cardDefId;
      if (rarity === 'rare') {
        // Rare always pulls from the global active pool
        const globalRare = await getActiveCardDefsByGender(genderCategory, 'rare');
        if (globalRare.length) {
          cardDefId = globalRare[Math.floor(Math.random() * globalRare.length)].id;
        } else {
          const any = banner.members[Math.floor(Math.random() * banner.members.length)];
          cardDefId = any.cardDefId;
          rarity = any.rarity;
        }
      } else {
        // SR/UR: banner pool first, fall back to global pool
        cardDefId = resolvePool(banner.members, rarity, rateUpIdolId, isComeback, config);
        if (cardDefId === null) {
          const globalPool = await getActiveCardDefsByGender(genderCategory, rarity);
          if (globalPool.length) {
            cardDefId = globalPool[Math.floor(Math.random() * globalPool.length)].id;
          } else {
            const any = banner.members[Math.floor(Math.random() * banner.members.length)];
            cardDefId = any.cardDefId;
            rarity = any.rarity;
          }
        }
      }

      const result = await addCardToCollection(userId, cardDefId, client);
      const def = await getCardDefById(cardDefId);
      const rateUpCard = banner.members.find(m => m.idolId === rateUpIdolId && m.rarity === rarity);

      cards.push({
        cardDefId,
        idolName: def?.idolName ?? 'Unknown',
        group: def?.group ?? '',
        rarity,
        artPath: def?.artPath ?? null,
        isRateUp: rateUpCard?.cardDefId === cardDefId,
        ...result,
      });

      if (rarity === 'ultra_rare') {
        urPity = 0;
        srPity = 0;
      } else if (rarity === 'super_rare') {
        srPity = 0;
        urPity++;
      } else {
        srPity++;
        urPity++;
      }
    }

    await setPityCounter(userId, genderCategory, 'super_rare', srPity, client);
    await setPityCounter(userId, genderCategory, 'ultra_rare', urPity, client);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { cards, freeUsed: freeToUse, currencySpent: currencyCost };
}

module.exports = { claimDailyPull, resolvePool, pull };
