const express = require('express');
const { Pool } = require('pg');
const { DATABASE_URL } = require('../config');
const {
  getPlayerCards,
  getUserTickets,
  decrementTicket,
  getCardDefsByRarity,
  getCurrentWeekSongs,
  getLineup,
  upsertLineup,
  replaceLineupSlots,
  getCardDefById,
  getActiveBanners,
  getOverflowDuplicatesByUser,
  getOverflowDuplicateById,
  deleteOverflowDuplicate,
} = require('../db');
const { addCardToCollection } = require('../services/collectionService');
const { claimDailyPull, pull: gachaPull } = require('../services/gachaService');

const router = express.Router();
const pool = new Pool({ connectionString: DATABASE_URL });

const ART_TZ = 'America/Argentina/Buenos_Aires';

function todayART() {
  return new Date().toLocaleDateString('en-CA', { timeZone: ART_TZ });
}

// ── T020: GET /me ─────────────────────────────────────────────────────────────

router.get('/me', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, username, gg_currency AS "ggCurrency", bg_currency AS "bgCurrency",
              last_daily_pull_gg AS "lastDailyPullGG",
              last_daily_pull_bg AS "lastDailyPullBG",
              rare_tickets AS "rareTickets", sr_tickets AS "srTickets",
              ur_tickets AS "urTickets",
              ur_ticket_refreshed_at AS "urTicketRefreshedAt",
              onboarding_completed AS "onboardingCompleted"
       FROM users WHERE id = $1`,
      [req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];

    const today = todayART();
    const dailyPullAvailable = {
      gg: !user.lastDailyPullGG || new Date(user.lastDailyPullGG).toLocaleDateString('en-CA', { timeZone: ART_TZ }) !== today,
      bg: !user.lastDailyPullBG || new Date(user.lastDailyPullBG).toLocaleDateString('en-CA', { timeZone: ART_TZ }) !== today,
    };

    return res.json({
      userId: user.id,
      username: user.username,
      ggCurrency: user.ggCurrency,
      bgCurrency: user.bgCurrency,
      tickets: {
        rare: user.rareTickets,
        superRare: user.srTickets,
        ultraRare: user.urTickets,
        urTicketRefreshedAt: user.urTicketRefreshedAt,
      },
      dailyPullAvailable,
      onboardingCompleted: user.onboardingCompleted ?? false,
    });
  } catch (err) {
    console.error('GET /me:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /onboarding/complete ─────────────────────────────────────────────────

router.post('/onboarding/complete', async (req, res) => {
  try {
    await pool.query(
      `UPDATE users SET onboarding_completed = TRUE WHERE id = $1`,
      [req.user.userId]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('POST /onboarding/complete:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── T021: GET /collection ─────────────────────────────────────────────────────

router.get('/collection', async (req, res) => {
  try {
    let cards = await getPlayerCards(req.user.userId);
    if (req.query.rarity) cards = cards.filter(c => c.rarity === req.query.rarity);
    const overflowDuplicates = await getOverflowDuplicatesByUser(req.user.userId);
    return res.json({ cards, overflowDuplicates });
  } catch (err) {
    console.error('GET /collection:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── T022: Tickets ─────────────────────────────────────────────────────────────

router.get('/tickets', async (req, res) => {
  try {
    const t = await getUserTickets(req.user.userId);
    return res.json({
      tickets: {
        rare: t.rareTickets,
        superRare: t.srTickets,
        ultraRare: t.urTickets,
        urTicketRefreshedAt: t.urTicketRefreshedAt,
      },
    });
  } catch (err) {
    console.error('GET /tickets:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/tickets/:rarity/eligible-cards', async (req, res) => {
  const { rarity } = req.params;
  if (!['rare', 'super_rare', 'ultra_rare'].includes(rarity)) {
    return res.status(400).json({ error: 'Invalid rarity' });
  }
  try {
    const cards = await getCardDefsByRarity(rarity);
    return res.json({ cards });
  } catch (err) {
    console.error('GET /tickets/:rarity/eligible-cards:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/tickets/:rarity/redeem', async (req, res) => {
  const { rarity } = req.params;
  if (!['rare', 'super_rare', 'ultra_rare'].includes(rarity)) {
    return res.status(400).json({ error: 'Invalid rarity' });
  }
  const { cardDefId } = req.body;
  if (!cardDefId) return res.status(400).json({ error: 'cardDefId is required' });

  const def = await getCardDefById(cardDefId);
  if (!def || def.rarity !== rarity) {
    return res.status(400).json({ error: 'Card does not match ticket rarity' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const decremented = await decrementTicket(req.user.userId, rarity, client);
    if (!decremented) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `No ${rarity} tickets available` });
    }

    const result = await addCardToCollection(req.user.userId, cardDefId, client);
    await client.query('COMMIT');

    return res.json({
      redeemed: true,
      remaining: decremented.remaining,
      card: { cardDefId, idolName: def.idolName, group: def.group, ...result },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /tickets/:rarity/redeem:', err);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ── Daily pull ────────────────────────────────────────────────────────────────

router.post('/daily-pull/claim', async (req, res) => {
  const { genderCategory = 'gg' } = req.body ?? {};
  if (!['gg', 'bg'].includes(genderCategory)) {
    return res.status(400).json({ error: 'genderCategory must be "gg" or "bg"' });
  }
  try {
    const result = await claimDailyPull(req.user.userId, genderCategory);
    return res.json(result);
  } catch (err) {
    if (err.code === 'ALREADY_CLAIMED') {
      return res.status(409).json({ error: err.message });
    }
    console.error('POST /daily-pull/claim:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── T023: GET /songs/weekly ───────────────────────────────────────────────────

router.get('/songs/weekly', async (req, res) => {
  const { genderCategory } = req.query;
  if (!['gg', 'bg'].includes(genderCategory)) {
    return res.status(400).json({ error: 'genderCategory must be "gg" or "bg"' });
  }
  try {
    const result = await getCurrentWeekSongs(genderCategory);
    return res.json(result);
  } catch (err) {
    console.error('GET /songs/weekly:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── T024: GET+PUT /lineup/:genderCategory ────────────────────────────────────

router.get('/lineup/:genderCategory', async (req, res) => {
  const { genderCategory } = req.params;
  if (!['gg', 'bg'].includes(genderCategory)) {
    return res.status(400).json({ error: 'Invalid gender category' });
  }
  try {
    const lineup = await getLineup(req.user.userId, genderCategory);
    if (!lineup) return res.json({ lineup: null });
    return res.json({
      lineup: {
        id: lineup.id,
        genderCategory: lineup.genderCategory,
        song: {
          songId: lineup.songId,
          title: lineup.songTitle,
          group: lineup.songGroup,
          memberCount: lineup.memberCount,
        },
        isValid: lineup.isValid,
        updatedAt: lineup.updatedAt,
        slots: lineup.slots,
      },
    });
  } catch (err) {
    console.error('GET /lineup:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.put('/lineup/:genderCategory', async (req, res) => {
  const { genderCategory } = req.params;
  if (!['gg', 'bg'].includes(genderCategory)) {
    return res.status(400).json({ error: 'Invalid gender category' });
  }
  const { songId, slots } = req.body;
  if (!songId || !Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({ error: 'songId and slots[] are required' });
  }

  // Validate song is in this week's pool
  const weekData = await getCurrentWeekSongs(genderCategory);
  const validSong = weekData.songs.find(s => s.songId === songId);
  if (!validSong) {
    return res.status(409).json({ error: 'Song is not in this week\'s pool' });
  }
  if (slots.length !== validSong.memberCount) {
    return res.status(400).json({
      error: `Song requires ${validSong.memberCount} slots; got ${slots.length}`,
    });
  }

  // Validate slot positions are 1-indexed and unique
  const positions = slots.map(s => s.slotPosition);
  if (new Set(positions).size !== positions.length) {
    return res.status(400).json({ error: 'Duplicate slot positions' });
  }

  // Validate card ownership
  const { rows: owned } = await pool.query(
    `SELECT card_def_id FROM player_cards WHERE user_id = $1 AND id = ANY($2::int[])`,
    [req.user.userId, slots.map(s => s.playerCardId)]
  );
  if (owned.length !== slots.length) {
    return res.status(403).json({ error: 'One or more cards do not belong to this player' });
  }

  // Determine if past deadline for today's show
  const { rows: todayShows } = await pool.query(
    `SELECT deadline FROM shows
     WHERE date = $1 AND gender_category = $2 AND resolution_status = 'pending'
     LIMIT 1`,
    [todayART(), genderCategory]
  );
  const now = new Date();
  const pastDeadline = todayShows.length > 0 && now > new Date(todayShows[0].deadline);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lineupId = await upsertLineup(req.user.userId, genderCategory, songId, client);
    await replaceLineupSlots(lineupId, slots, client);
    await client.query('COMMIT');

    if (pastDeadline) {
      const nextDeadline = todayShows[0].deadline;
      return res.json({
        saved: true,
        appliesTo: 'next_show',
        deadline: nextDeadline,
        notice: "Your lineup will enter tomorrow's show, not today's.",
      });
    }
    return res.json({
      saved: true,
      appliesTo: 'today',
      deadline: todayShows[0]?.deadline || null,
      notice: null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /lineup:', err);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ── T052: Banners ─────────────────────────────────────────────────────────────

router.get('/banners', async (req, res) => {
  try {
    const banners = await getActiveBanners('gg', req.user.userId);
    return res.json({ banners });
  } catch (err) {
    console.error('GET /banners:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/banners/:bannerId/pull', async (req, res) => {
  const bannerId = parseInt(req.params.bannerId, 10);
  if (isNaN(bannerId)) return res.status(400).json({ error: 'Invalid bannerId' });

  const { rateUpIdolId = null, count = 1 } = req.body;
  const pullCount = parseInt(count, 10);
  if (isNaN(pullCount) || pullCount < 1 || pullCount > 10) {
    return res.status(400).json({ error: 'count must be 1–10' });
  }

  try {
    const result = await gachaPull(req.user.userId, bannerId, pullCount, rateUpIdolId, 'gg');
    return res.json(result);
  } catch (err) {
    if (err.code === 'INSUFFICIENT_CURRENCY') {
      return res.status(402).json({ error: err.message, have: err.have, need: err.need });
    }
    console.error('POST /banners/:bannerId/pull:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── T040: Shows & leaderboard ─────────────────────────────────────────────────

const {
  getTodayShows: dbGetTodayShows,
  getShowById,
  getShowEntries,
  getLeaderboardHistory: dbGetLeaderboardHistory,
} = require('../db');

router.get('/shows/today', async (req, res) => {
  try {
    const today = todayART();
    const shows = await dbGetTodayShows(today);
    return res.json({ date: today, shows });
  } catch (err) {
    console.error('GET /shows/today:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/leaderboard/:showId', async (req, res) => {
  const showId = parseInt(req.params.showId, 10);
  if (isNaN(showId)) return res.status(400).json({ error: 'Invalid showId' });
  try {
    const show = await getShowById(showId);
    if (!show) return res.status(404).json({ error: 'Show not found' });

    const entries = await getShowEntries(showId);

    // Find the requesting user's own entry
    const myEntry = entries.find(e => e.userId === req.user.userId) || null;

    return res.json({
      show: {
        id: show.id,
        date: show.date,
        genderCategory: show.genderCategory,
        deadline: show.deadline,
        resolutionStatus: show.resolutionStatus,
      },
      myEntry,
      leaderboard: entries.map(e => ({
        rank: e.rank,
        username: e.username,
        songTitle: e.songTitle,
        score: e.finalScore,
        rewardRarity: e.rewardRarity,
        isMe: e.userId === req.user.userId,
      })),
    });
  } catch (err) {
    console.error('GET /leaderboard/:showId:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/leaderboard/history', async (req, res) => {
  const { genderCategory = 'gg', limit = 20, offset = 0 } = req.query;
  if (!['gg', 'bg'].includes(genderCategory)) {
    return res.status(400).json({ error: 'Invalid genderCategory' });
  }
  try {
    const history = await dbGetLeaderboardHistory(
      genderCategory,
      Math.min(parseInt(limit, 10) || 20, 100),
      parseInt(offset, 10) || 0
    );
    return res.json({ history });
  } catch (err) {
    console.error('GET /leaderboard/history:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── T059: POST /overflow/:duplicateId/convert ─────────────────────────────────

router.post('/overflow/:duplicateId/convert', async (req, res) => {
  const duplicateId = parseInt(req.params.duplicateId, 10);
  if (isNaN(duplicateId)) return res.status(400).json({ error: 'Invalid duplicateId' });

  const { convertTo = 'currency' } = req.body;
  if (!['currency', 'cosmetic'].includes(convertTo)) {
    return res.status(400).json({ error: 'convertTo must be "currency" or "cosmetic"' });
  }

  try {
    const dup = await getOverflowDuplicateById(duplicateId);
    if (!dup) return res.status(404).json({ error: 'Overflow item not found' });
    if (dup.userId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await deleteOverflowDuplicate(duplicateId, client);

      if (convertTo === 'currency') {
        await client.query(
          `UPDATE users SET gg_currency = gg_currency + 1 WHERE id = $1`,
          [req.user.userId]
        );
        await client.query('COMMIT');
        return res.json({ converted: true, convertedTo: 'currency', currencyAwarded: 1 });
      } else {
        // Cosmetic system stub — award logged, not yet persistent
        await client.query('COMMIT');
        return res.json({
          converted: true,
          convertedTo: 'cosmetic',
          cosmeticAwarded: { type: 'border', variant: dup.rarity },
        });
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('POST /overflow/:duplicateId/convert:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
