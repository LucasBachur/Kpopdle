const { Pool } = require('pg');
const { DATABASE_URL } = require('./config');

const pool = new Pool({ connectionString: DATABASE_URL });

const TABLE_MAP = {
  idols:             'idols',
  songs:             'songs',
  dailyAnswers:      'daily_answers',
  dailyAnswersSongs: 'daily_answers_songs',
};

const QUERIES = {
  idols: `
    SELECT id, name, "group", group_type AS "groupType",
           TO_CHAR(birth_date, 'YYYY-MM-DD') AS "birthDate",
           nationality, company
    FROM idols
  `,
  songs: `
    SELECT id, title, "group", group_type AS "groupType"
    FROM songs
  `,
  daily_answers: `
    SELECT id, mode, TO_CHAR(date, 'YYYY-MM-DD') AS date, answer_id AS "answerId"
    FROM daily_answers
  `,
  daily_answers_songs: `
    SELECT id, mode, TO_CHAR(date, 'YYYY-MM-DD') AS date, answer_id AS "answerId"
    FROM daily_answers_songs
  `,
};

async function getFromDB(dataset) {
  const table = TABLE_MAP[dataset];
  if (!table) {
    console.error(`Unknown dataset: ${dataset}`);
    return [];
  }
  try {
    const { rows } = await pool.query(QUERIES[table]);
    return rows;
  } catch (err) {
    console.error(`Error fetching ${dataset}:`, err);
    return [];
  }
}

async function saveAnswers(collectionName, entries) {
  const table = TABLE_MAP[collectionName];
  if (!table) {
    console.error(`Unknown collection: ${collectionName}`);
    return;
  }
  try {
    for (const entry of entries) {
      await pool.query(
        `INSERT INTO ${table} (mode, date, answer_id) VALUES ($1, $2, $3)`,
        [entry.mode, entry.date, entry.answerId]
      );
    }
  } catch (err) {
    console.error('Error saving answers:', err);
  }
}

async function closeClient() {
  await pool.end();
}

module.exports = { getFromDB, saveAnswers, closeClient, pool };

// ── T013: card_definitions ───────────────────────────────────────────────────

async function getAllCardDefs() {
  const { rows } = await pool.query(`
    SELECT cd.id, cd.idol_id AS "idolId", i.name AS "idolName", i."group", i.company,
           i.roles, cd.rarity, cd.base_stat AS "baseStat",
           COALESCE(cd.art_path, cd.rarity || '/' || cd.id::text || '.webp') AS "artPath", cd.border_style AS "borderStyle",
           cd.released_at AS "releasedAt", cd.is_active AS "isActive"
    FROM card_definitions cd
    JOIN idols i ON i.id = cd.idol_id
    ORDER BY cd.id
  `);
  return rows;
}

async function getCardDefsByRarity(rarity) {
  const { rows } = await pool.query(`
    SELECT cd.id, cd.idol_id AS "idolId", i.name AS "idolName", i."group",
           cd.rarity, cd.base_stat AS "baseStat",
           COALESCE(cd.art_path, cd.rarity || '/' || cd.id::text || '.webp') AS "artPath", cd.border_style AS "borderStyle",
           cd.is_active AS "isActive"
    FROM card_definitions cd
    JOIN idols i ON i.id = cd.idol_id
    WHERE cd.rarity = $1 AND cd.is_active = TRUE
    ORDER BY cd.id
  `, [rarity]);
  return rows;
}

async function getCardDefById(id) {
  const { rows } = await pool.query(`
    SELECT cd.id, cd.idol_id AS "idolId", i.name AS "idolName", i."group",
           i.company, i.roles, cd.rarity, cd.base_stat AS "baseStat",
           COALESCE(cd.art_path, cd.rarity || '/' || cd.id::text || '.webp') AS "artPath", cd.border_style AS "borderStyle",
           cd.is_active AS "isActive"
    FROM card_definitions cd
    JOIN idols i ON i.id = cd.idol_id
    WHERE cd.id = $1
  `, [id]);
  return rows[0] || null;
}

async function getActiveCardDefsByGender(genderCategory, rarity) {
  const { rows } = await pool.query(`
    SELECT cd.id, cd.idol_id AS "idolId", i.name AS "idolName", i."group",
           i.group_type AS "groupType", i.company, i.roles,
           cd.rarity, cd.base_stat AS "baseStat",
           COALESCE(cd.art_path, cd.rarity || '/' || cd.id::text || '.webp') AS "artPath", cd.border_style AS "borderStyle"
    FROM card_definitions cd
    JOIN idols i ON i.id = cd.idol_id
    WHERE cd.is_active = TRUE
      AND i.group_type = $1
      AND ($2::TEXT IS NULL OR cd.rarity = $2)
    ORDER BY cd.id
  `, [genderCategory === 'gg' ? 'Girl Group' : 'Boy Group', rarity || null]);
  return rows;
}

// ── T014: player_cards ───────────────────────────────────────────────────────

async function getPlayerCards(userId) {
  const { rows } = await pool.query(`
    SELECT pc.id AS "playerCardId", pc.card_def_id AS "cardDefId",
           i.name AS "idolName", i."group", cd.rarity,
           cd.base_stat AS "baseStat", pc.current_stat AS "currentStat",
           COALESCE(cd.art_path, cd.rarity || '/' || cd.id::text || '.webp') AS "artPath", cd.border_style AS "borderStyle",
           pc.acquired_at AS "acquiredAt",
           (SELECT COUNT(*)::int FROM idols i2 WHERE i2."group" = i."group") AS "groupSize"
    FROM player_cards pc
    JOIN card_definitions cd ON cd.id = pc.card_def_id
    JOIN idols i ON i.id = cd.idol_id
    WHERE pc.user_id = $1
    ORDER BY cd.rarity, i."group", i.name
  `, [userId]);
  return rows;
}

async function getPlayerCard(userId, cardDefId, client) {
  const db = client || pool;
  const { rows } = await db.query(
    `SELECT id AS "playerCardId", current_stat AS "currentStat"
     FROM player_cards WHERE user_id = $1 AND card_def_id = $2`,
    [userId, cardDefId]
  );
  return rows[0] || null;
}

async function insertPlayerCard(userId, cardDefId, baseStat, client) {
  const db = client || pool;
  const { rows } = await db.query(
    `INSERT INTO player_cards (user_id, card_def_id, current_stat)
     VALUES ($1, $2, $3) RETURNING id AS "playerCardId", current_stat AS "currentStat"`,
    [userId, cardDefId, baseStat]
  );
  return rows[0];
}

async function incrementPlayerCardStat(playerCardId, client) {
  const db = client || pool;
  const { rows } = await db.query(
    `UPDATE player_cards SET current_stat = current_stat + 1
     WHERE id = $1 RETURNING current_stat AS "currentStat"`,
    [playerCardId]
  );
  return rows[0];
}

// ── T015: tickets (counts on users row) ──────────────────────────────────────

const TICKET_COL = { rare: 'rare_tickets', super_rare: 'sr_tickets', ultra_rare: 'ur_tickets' };

async function getUserTickets(userId) {
  const { rows } = await pool.query(
    `SELECT rare_tickets AS "rareTickets", sr_tickets AS "srTickets",
            ur_tickets AS "urTickets",
            ur_ticket_refreshed_at AS "urTicketRefreshedAt"
     FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
}

// Returns the updated row, or null if the user had no tickets of that rarity.
async function decrementTicket(userId, rarity, client) {
  const db = client || pool;
  const col = TICKET_COL[rarity];
  if (!col) throw new Error(`Unknown rarity: ${rarity}`);
  const { rows } = await db.query(
    `UPDATE users SET ${col} = ${col} - 1
     WHERE id = $1 AND ${col} > 0
     RETURNING ${col} AS "remaining"`,
    [userId]
  );
  return rows[0] || null;
}

async function incrementTicket(userId, rarity, client) {
  const db = client || pool;
  const col = TICKET_COL[rarity];
  if (!col) throw new Error(`Unknown rarity: ${rarity}`);
  await db.query(
    `UPDATE users SET ${col} = ${col} + 1 WHERE id = $1`,
    [userId]
  );
}

// ── T016: weekly_song_pools ──────────────────────────────────────────────────

function getMonday(date = new Date()) {
  const d = new Date(date);
  // Convert to ART (UTC-3) before computing ISO week Monday
  const artOffset = -3 * 60;
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
  const artMs = utcMs + artOffset * 60000;
  const art = new Date(artMs);
  const day = art.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  art.setDate(art.getDate() + diff);
  return art.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function getCurrentWeekSongs(genderCategory) {
  const weekStart = getMonday();
  const { rows } = await pool.query(`
    SELECT s.id AS "songId", s.title, s."group",
           s.group_type AS "groupType", s.member_count AS "memberCount"
    FROM weekly_song_pools wsp
    JOIN songs s ON s.id = wsp.song_id
    WHERE wsp.week_start_date = $1 AND wsp.gender_category = $2
    ORDER BY s.title
  `, [weekStart, genderCategory]);
  return { weekStartDate: weekStart, songs: rows };
}

// ── T017: lineups ────────────────────────────────────────────────────────────

async function getLineup(userId, genderCategory) {
  const { rows } = await pool.query(`
    SELECT l.id, l.gender_category AS "genderCategory",
           l.song_id AS "songId", l.is_valid AS "isValid",
           l.updated_at AS "updatedAt",
           s.title AS "songTitle", s."group" AS "songGroup",
           s.member_count AS "memberCount"
    FROM lineups l
    JOIN songs s ON s.id = l.song_id
    WHERE l.user_id = $1 AND l.gender_category = $2
  `, [userId, genderCategory]);
  if (!rows.length) return null;
  const lineup = rows[0];

  const { rows: slotRows } = await pool.query(`
    SELECT ls.slot_position AS "slotPosition",
           ls.player_card_id AS "playerCardId",
           pc.card_def_id AS "cardDefId",
           i.name AS "idolName", cd.rarity,
           pc.current_stat AS "currentStat",
           COALESCE(cd.art_path, cd.rarity || '/' || cd.id::text || '.webp') AS "artPath"
    FROM lineup_slots ls
    JOIN player_cards pc ON pc.id = ls.player_card_id
    JOIN card_definitions cd ON cd.id = pc.card_def_id
    JOIN idols i ON i.id = cd.idol_id
    WHERE ls.lineup_id = $1
    ORDER BY ls.slot_position
  `, [lineup.id]);

  return { ...lineup, slots: slotRows };
}

async function upsertLineup(userId, genderCategory, songId, client) {
  const db = client || pool;
  const { rows } = await db.query(`
    INSERT INTO lineups (user_id, gender_category, song_id, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id, gender_category)
    DO UPDATE SET song_id = EXCLUDED.song_id,
                  is_valid = TRUE,
                  updated_at = NOW()
    RETURNING id
  `, [userId, genderCategory, songId]);
  return rows[0].id;
}

async function replaceLineupSlots(lineupId, slots, client) {
  const db = client || pool;
  await db.query('DELETE FROM lineup_slots WHERE lineup_id = $1', [lineupId]);
  for (const slot of slots) {
    await db.query(
      `INSERT INTO lineup_slots (lineup_id, slot_position, player_card_id)
       VALUES ($1, $2, $3)`,
      [lineupId, slot.slotPosition, slot.playerCardId]
    );
  }
}

// ── T031: show_schedules / shows ─────────────────────────────────────────────

async function getShowScheduleByDayOfWeek(dayOfWeek, genderCategory) {
  const { rows } = await pool.query(
    `SELECT id, gender_category AS "genderCategory", day_of_week AS "dayOfWeek",
            show_name AS "showName", deadline_time AS "deadlineTime", timezone
     FROM show_schedules
     WHERE day_of_week = $1 AND gender_category = $2`,
    [dayOfWeek, genderCategory]
  );
  return rows[0] || null;
}

async function getOrCreateTodayShow(date, genderCategory, scheduleId, showName, deadlineUtc) {
  // date is YYYY-MM-DD in ART
  const { rows } = await pool.query(
    `INSERT INTO shows (date, gender_category, schedule_id, show_name, deadline, resolution_status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     ON CONFLICT (date, gender_category) DO UPDATE
       SET deadline = EXCLUDED.deadline
       WHERE shows.resolution_status = 'pending'
     RETURNING id, date, gender_category AS "genderCategory", schedule_id AS "scheduleId",
               show_name AS "showName", deadline, resolution_status AS "resolutionStatus",
               (xmax = 0) AS "created"`,
    [date, genderCategory, scheduleId, showName, deadlineUtc]
  );
  if (rows.length) return rows[0];
  // Row exists but was already resolved — return it unchanged
  const { rows: existing } = await pool.query(
    `SELECT id, date, gender_category AS "genderCategory", schedule_id AS "scheduleId",
            show_name AS "showName", deadline, resolution_status AS "resolutionStatus",
            false AS "created"
     FROM shows WHERE date = $1 AND gender_category = $2`,
    [date, genderCategory]
  );
  return existing[0];
}

async function getShowById(showId) {
  const { rows } = await pool.query(
    `SELECT id, date, gender_category AS "genderCategory", schedule_id AS "scheduleId",
            deadline, resolution_status AS "resolutionStatus", resolved_at AS "resolvedAt"
     FROM shows WHERE id = $1`,
    [showId]
  );
  return rows[0] || null;
}

async function getPendingShows() {
  const { rows } = await pool.query(
    `SELECT id, date, gender_category AS "genderCategory", schedule_id AS "scheduleId",
            deadline, resolution_status AS "resolutionStatus"
     FROM shows
     WHERE resolution_status = 'pending' AND deadline <= NOW()
     ORDER BY deadline`
  );
  return rows;
}

async function markShowResolved(showId, client) {
  const db = client || pool;
  await db.query(
    `UPDATE shows SET resolution_status = 'resolved', resolved_at = NOW() WHERE id = $1`,
    [showId]
  );
}

async function getTodayShows(date) {
  const { rows } = await pool.query(
    `SELECT s.id, s.date, s.gender_category AS "genderCategory",
            s.deadline, s.resolution_status AS "resolutionStatus",
            ss.deadline_time AS "deadlineTime"
     FROM shows s
     JOIN show_schedules ss ON ss.id = s.schedule_id
     WHERE s.date = $1
     ORDER BY s.gender_category`,
    [date]
  );
  return rows;
}

// ── T032: show_entries ────────────────────────────────────────────────────────

async function getShowEntries(showId) {
  const { rows } = await pool.query(
    `SELECT se.id, se.show_id AS "showId", se.user_id AS "userId",
            se.song_id AS "songId",
            se.base_score AS "baseScore", se.final_score AS "finalScore",
            se.rank, se.reward_rarity AS "rewardRarity",
            u.username, s.title AS "songTitle"
     FROM show_entries se
     JOIN users u ON u.id = se.user_id
     JOIN songs s ON s.id = se.song_id
     WHERE se.show_id = $1
     ORDER BY se.rank ASC NULLS LAST, se.final_score DESC`,
    [showId]
  );
  return rows;
}

async function getShowEntry(showId, userId) {
  const { rows } = await pool.query(
    `SELECT id, show_id AS "showId", user_id AS "userId",
            song_id AS "songId", base_score AS "baseScore",
            final_score AS "finalScore", rank, reward_rarity AS "rewardRarity"
     FROM show_entries WHERE show_id = $1 AND user_id = $2`,
    [showId, userId]
  );
  return rows[0] || null;
}

// cardSnapshot = array of slot objects (frozen at resolution time)
async function insertShowEntry(showId, userId, songId, baseScore, finalScore, cardSnapshot, client) {
  const db = client || pool;
  const { rows } = await db.query(
    `INSERT INTO show_entries (show_id, user_id, song_id, base_score, final_score, card_snapshot)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (show_id, user_id) DO UPDATE
       SET base_score = EXCLUDED.base_score,
           final_score = EXCLUDED.final_score,
           card_snapshot = EXCLUDED.card_snapshot
     RETURNING id`,
    [showId, userId, songId, baseScore, finalScore, JSON.stringify(cardSnapshot)]
  );
  return rows[0].id;
}

async function updateShowEntryRankReward(entryId, rank, rewardRarity, client) {
  const db = client || pool;
  await db.query(
    `UPDATE show_entries SET rank = $2, reward_rarity = $3, reward_issued_at = NOW() WHERE id = $1`,
    [entryId, rank, rewardRarity]
  );
}

async function getLeaderboardHistory(genderCategory, limit = 20, offset = 0) {
  const { rows } = await pool.query(
    `SELECT se.show_id AS "showId", s.date, se.final_score AS "score", se.rank,
            se.reward_rarity AS "rewardRarity", s.gender_category AS "genderCategory",
            sg.title AS "songTitle"
     FROM show_entries se
     JOIN shows s ON s.id = se.show_id
     JOIN songs sg ON sg.id = se.song_id
     WHERE s.gender_category = $1 AND s.resolution_status = 'resolved'
     ORDER BY s.date DESC, se.rank ASC
     LIMIT $2 OFFSET $3`,
    [genderCategory, limit, offset]
  );
  return rows;
}

// ── T033: show_multipliers ────────────────────────────────────────────────────

async function getShowMultipliers(showId) {
  const { rows } = await pool.query(
    `SELECT id, label, multiplier_value AS "multiplierValue",
            applies_to_type AS "appliesToType", applies_to_value AS "appliesToValue"
     FROM show_multipliers WHERE show_id = $1`,
    [showId]
  );
  return rows;
}

async function getShowMultiplierLabels(showId) {
  const { rows } = await pool.query(
    `SELECT label FROM show_multipliers WHERE show_id = $1 ORDER BY id`,
    [showId]
  );
  return rows.map(r => r.label);
}

async function copyScheduleMultipliers(showId, scheduleId) {
  if (scheduleId == null) return 0;
  const { rowCount } = await pool.query(
    `INSERT INTO show_multipliers (show_id, label, multiplier_value, applies_to_type, applies_to_value)
     SELECT $1, label, multiplier_value, applies_to_type, applies_to_value
     FROM show_schedule_multipliers WHERE schedule_id = $2
     ON CONFLICT (show_id, applies_to_type, COALESCE(applies_to_value, '')) DO NOTHING`,
    [showId, scheduleId]
  );
  console.log(`[scheduler] Copied ${rowCount} multiplier templates to show ${showId} from schedule ${scheduleId}`);
  return rowCount;
}

// ── T031+: gacha_config ───────────────────────────────────────────────────────

async function getGachaConfig() {
  const { rows } = await pool.query('SELECT key, value FROM gacha_config');
  return Object.fromEntries(rows.map(r => [r.key, parseFloat(r.value)]));
}

// GG-only launch flag. Enabled (BG sealed off) when the row is missing or the
// value is anything other than explicit '0'. Returns false only for '0'.
async function getGgOnlyMode() {
  const { rows } = await pool.query(
    `SELECT value FROM gacha_config WHERE key = 'gg_only_mode'`
  );
  if (!rows.length) return true;
  return parseFloat(rows[0].value) !== 0;
}

// ── T045: banners ─────────────────────────────────────────────────────────────

const BANNER_MEMBERS_AGG = `
  json_agg(json_build_object(
    'cardDefId', cd.id,
    'idolId',   cd.idol_id,
    'idolName', i.name,
    'group',    i.group,
    'artPath',  COALESCE(cd.art_path, cd.rarity || '/' || cd.id::text || '.webp'),
    'rarity',   cd.rarity
  ) ORDER BY i.name) AS members
`;

async function getActiveBanners(genderCategory, userId) {
  const { rows } = await pool.query(`
    SELECT b.id, b.group_name AS "groupName",
           b.gender_category AS "genderCategory",
           b.starts_at AS "startsAt", b.ends_at AS "endsAt",
           b.description,
           COALESCE(bfp.free_pulls_remaining, 0) AS "freePullsRemaining",
           ${BANNER_MEMBERS_AGG}
    FROM banners b
    JOIN banner_cards bc ON bc.banner_id = b.id
    JOIN card_definitions cd ON cd.id = bc.card_def_id
    JOIN idols i ON i.id = cd.idol_id
    LEFT JOIN banner_free_pulls bfp ON bfp.banner_id = b.id AND bfp.user_id = $2
    WHERE b.is_active = TRUE
      AND b.gender_category = $1
      AND b.starts_at <= NOW()
      AND (b.ends_at IS NULL OR b.ends_at >= NOW())
    GROUP BY b.id, bfp.free_pulls_remaining
    ORDER BY b.ends_at NULLS LAST
  `, [genderCategory, userId]);
  return rows;
}

async function getBannerWithMembers(bannerId) {
  const { rows } = await pool.query(`
    SELECT b.id, b.group_name AS "groupName",
           b.gender_category AS "genderCategory",
           b.starts_at AS "startsAt", b.ends_at AS "endsAt",
           b.description, ${BANNER_MEMBERS_AGG}
    FROM banners b
    JOIN banner_cards bc ON bc.banner_id = b.id
    JOIN card_definitions cd ON cd.id = bc.card_def_id
    JOIN idols i ON i.id = cd.idol_id
    WHERE b.id = $1
    GROUP BY b.id
  `, [bannerId]);
  return rows[0] || null;
}

async function getDailyBanner(genderCategory) {
  const { rows } = await pool.query(`
    SELECT id, group_name AS "groupName",
           gender_category AS "genderCategory",
           starts_at AS "startsAt", ends_at AS "endsAt", description
    FROM banners
    WHERE is_active = TRUE
      AND gender_category = $1
      AND ends_at IS NULL
      AND description = 'daily'
    LIMIT 1
  `, [genderCategory]);
  return rows[0] || null;
}

// Returns all card_definitions of a given rarity that appear on currently active
// non-daily banners (used for the daily banner's SR pool).
async function getActiveBannerCardsByRarity(genderCategory, rarity) {
  const { rows } = await pool.query(`
    SELECT DISTINCT cd.id, cd.rarity, cd.base_stat AS "baseStat",
           i.name AS "idolName", i."group"
    FROM banners b
    JOIN banner_cards bc ON bc.banner_id = b.id
    JOIN card_definitions cd ON cd.id = bc.card_def_id
    JOIN idols i ON i.id = cd.idol_id
    WHERE b.is_active = TRUE
      AND b.gender_category = $1
      AND b.starts_at <= NOW()
      AND (b.ends_at IS NULL OR b.ends_at >= NOW())
      AND b.description != 'daily'
      AND cd.rarity = $2
  `, [genderCategory, rarity]);
  return rows;
}

async function getBannerFreePulls(userId, bannerId) {
  const { rows } = await pool.query(
    `SELECT free_pulls_remaining AS "freePullsRemaining", claimed_at AS "claimedAt"
     FROM banner_free_pulls
     WHERE user_id = $1 AND banner_id = $2`,
    [userId, bannerId]
  );
  return rows[0] ?? { freePullsRemaining: 0, claimedAt: null };
}

async function consumeBannerFreePulls(userId, bannerId, count, client) {
  const db = client || pool;
  await db.query(
    `UPDATE banner_free_pulls
     SET free_pulls_remaining = free_pulls_remaining - $3,
         claimed_at = COALESCE(claimed_at, NOW())
     WHERE user_id = $1 AND banner_id = $2`,
    [userId, bannerId, count]
  );
}

// ── T057: overflow_duplicates ────────────────────────────────────────────────

async function insertOverflowDuplicate(userId, cardDefId, client) {
  const db = client || pool;
  const { rows } = await db.query(
    `INSERT INTO overflow_duplicates (user_id, card_def_id)
     VALUES ($1, $2) RETURNING id`,
    [userId, cardDefId]
  );
  return rows[0];
}

async function getOverflowDuplicatesByUser(userId) {
  const { rows } = await pool.query(
    `SELECT od.id, od.card_def_id AS "cardDefId", od.received_at AS "receivedAt",
            i.name AS "idolName", i."group", cd.rarity,
            cd.base_stat AS "baseStat", COALESCE(cd.art_path, cd.rarity || '/' || cd.id::text || '.webp') AS "artPath",
            cd.border_style AS "borderStyle"
     FROM overflow_duplicates od
     JOIN card_definitions cd ON cd.id = od.card_def_id
     JOIN idols i ON i.id = cd.idol_id
     WHERE od.user_id = $1
     ORDER BY od.received_at DESC`,
    [userId]
  );
  return rows;
}

async function getOverflowDuplicateById(duplicateId) {
  const { rows } = await pool.query(
    `SELECT od.id, od.user_id AS "userId", od.card_def_id AS "cardDefId",
            cd.rarity
     FROM overflow_duplicates od
     JOIN card_definitions cd ON cd.id = od.card_def_id
     WHERE od.id = $1`,
    [duplicateId]
  );
  return rows[0] || null;
}

async function deleteOverflowDuplicate(duplicateId, client) {
  const db = client || pool;
  await db.query('DELETE FROM overflow_duplicates WHERE id = $1', [duplicateId]);
}

// ── T046: pity_counters ───────────────────────────────────────────────────────

async function getPityCounter(userId, genderCategory, targetRarity) {
  const { rows } = await pool.query(
    `SELECT pull_count AS "pullCount" FROM pity_counters
     WHERE user_id = $1 AND gender_category = $2 AND target_rarity = $3`,
    [userId, genderCategory, targetRarity]
  );
  return rows[0]?.pullCount ?? 0;
}

async function setPityCounter(userId, genderCategory, targetRarity, count, client) {
  const db = client || pool;
  await db.query(
    `INSERT INTO pity_counters (user_id, gender_category, target_rarity, pull_count)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, gender_category, target_rarity)
     DO UPDATE SET pull_count = EXCLUDED.pull_count`,
    [userId, genderCategory, targetRarity, count]
  );
}

// ── Feature 002: weekly pool ──────────────────────────────────────────────────

async function getPoolSize() {
  const { rows } = await pool.query(
    `SELECT value FROM gacha_config WHERE key = 'weekly_pool_size'`
  );
  return rows.length ? parseInt(rows[0].value, 10) : 25;
}

const GENDER_TO_GROUP_TYPE = { gg: 'Girl Group', bg: 'Boy Group' };

async function getEligibleSongIds(genderCategory) {
  const groupType = GENDER_TO_GROUP_TYPE[genderCategory] ?? genderCategory;
  const { rows } = await pool.query(
    `SELECT id FROM songs WHERE group_type = $1 AND member_count >= 1`,
    [groupType]
  );
  return rows.map(r => r.id);
}

async function getWeekPoolSongIds(weekStart, genderCategory) {
  const { rows } = await pool.query(
    `SELECT song_id FROM weekly_song_pools
     WHERE week_start_date = $1 AND gender_category = $2`,
    [weekStart, genderCategory]
  );
  return rows.map(r => r.song_id);
}

async function weekPoolExists(weekStart, genderCategory) {
  const { rows } = await pool.query(
    `SELECT 1 FROM weekly_song_pools
     WHERE week_start_date = $1 AND gender_category = $2
     LIMIT 1`,
    [weekStart, genderCategory]
  );
  return rows.length > 0;
}

async function insertWeekPoolRows(weekStart, genderCategory, songIds) {
  if (songIds.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const placeholders = songIds.map((_, i) => `($1, $2, $${i + 3})`).join(', ');
    await client.query(
      `INSERT INTO weekly_song_pools (week_start_date, gender_category, song_id)
       VALUES ${placeholders}
       ON CONFLICT (week_start_date, gender_category, song_id) DO NOTHING`,
      [weekStart, genderCategory, ...songIds]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getIdolsMissingRoles() {
  const [{ rows: countRows }, { rows: missingRows }] = await Promise.all([
    pool.query('SELECT count(*) AS total FROM idols'),
    pool.query(`SELECT id, name FROM idols WHERE roles = '{}' ORDER BY id`),
  ]);
  return {
    totalIdols: parseInt(countRows[0].total, 10),
    missingRoles: missingRows,
  };
}

async function invalidateLineupsForGender(genderCategory, poolSongIds) {
  if (poolSongIds.length === 0) return 0;
  const placeholders = poolSongIds.map((_, i) => `$${i + 2}`).join(', ');
  const { rowCount } = await pool.query(
    `UPDATE lineups SET is_valid = FALSE
     WHERE gender_category = $1 AND song_id NOT IN (${placeholders})`,
    [genderCategory, ...poolSongIds]
  );
  return rowCount;
}

// ── Feature 004: annual UR ticket grant ──────────────────────────────────────

async function getUrGrantDates() {
  const { rows } = await pool.query('SELECT month, day FROM ur_grant_dates');
  return rows;
}

// Idempotent grant for a single calendar date (YYYY-MM-DD). The marker insert
// and the per-user ticket grant run in one transaction so they commit together.
// Returns { granted, usersAffected }: granted=false means today was already
// processed (marker present), so no tickets were added.
async function grantUrTicketsForDate(grantDateStr) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount: marked } = await client.query(
      `INSERT INTO ur_grant_log (grant_date) VALUES ($1) ON CONFLICT DO NOTHING`,
      [grantDateStr]
    );
    if (marked !== 1) {
      await client.query('ROLLBACK');
      return { granted: false, usersAffected: 0 };
    }
    const { rowCount: usersAffected } = await client.query(
      `UPDATE users SET ur_tickets = ur_tickets + 1`
    );
    await client.query('COMMIT');
    return { granted: true, usersAffected };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getFromDB, saveAnswers, closeClient, pool,
  // card_definitions
  getAllCardDefs, getCardDefsByRarity, getCardDefById, getActiveCardDefsByGender,
  // player_cards
  getPlayerCards, getPlayerCard, insertPlayerCard, incrementPlayerCardStat,
  // tickets
  getUserTickets, decrementTicket, incrementTicket,
  // songs
  getCurrentWeekSongs, getMonday,
  // lineups
  getLineup, upsertLineup, replaceLineupSlots,
  // shows
  getShowScheduleByDayOfWeek, getOrCreateTodayShow, getShowById,
  getPendingShows, markShowResolved, getTodayShows,
  // show_entries
  getShowEntries, getShowEntry, insertShowEntry, updateShowEntryRankReward,
  getLeaderboardHistory,
  // show_multipliers
  getShowMultipliers, getShowMultiplierLabels, copyScheduleMultipliers,
  // gacha_config
  getGachaConfig, getGgOnlyMode,
  // banners
  getActiveBanners, getBannerWithMembers, getDailyBanner,
  getBannerFreePulls, consumeBannerFreePulls, getActiveBannerCardsByRarity,
  // overflow_duplicates
  insertOverflowDuplicate, getOverflowDuplicatesByUser,
  getOverflowDuplicateById, deleteOverflowDuplicate,
  // pity_counters
  getPityCounter, setPityCounter,
  // weekly pool (feature 002)
  getPoolSize, getEligibleSongIds, getWeekPoolSongIds, weekPoolExists, insertWeekPoolRows,
  getIdolsMissingRoles, invalidateLineupsForGender,
  // annual UR grant (feature 004)
  getUrGrantDates, grantUrTicketsForDate,
};
