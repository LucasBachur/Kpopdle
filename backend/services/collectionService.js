const {
  pool,
  getAllCardDefs,
  getPlayerCard,
  insertPlayerCard,
  incrementPlayerCardStat,
  getCardDefById,
  insertOverflowDuplicate,
  getActiveBannerCardsByRarity,
} = require('../db');

const RARITY_CEILING = { rare: 85, super_rare: 95, ultra_rare: 99 };

// Called during registration: N random pulls from the daily banner (configurable).
// Returns the card array for the reveal UI. Uses the daily banner's SR rate;
// falls back to the global active pool per rarity if the banner has no cards for it.
async function createStarterCollection(userId, client) {
  const db = client || pool;

  const configRows = await pool.query(
    `SELECT key, value::text FROM gacha_config
     WHERE key IN ('starter_pull_count', 'daily_banner_sr_rate')`
  );
  const cfg = Object.fromEntries(configRows.rows.map(r => [r.key, parseFloat(r.value)]));
  const pullCount = cfg.starter_pull_count ?? 30;
  const srRate    = cfg.daily_banner_sr_rate ?? 0.03;

  // Rare: global active pool. SR: active event banner pools, fallback to global SR.
  const [rareRows, eventSrRows, globalSrRows] = await Promise.all([
    pool.query(
      `SELECT cd.id, cd.rarity, cd.base_stat AS "baseStat",
              i.name AS "idolName", i."group"
       FROM card_definitions cd JOIN idols i ON i.id = cd.idol_id
       WHERE cd.rarity = 'rare' AND cd.is_active = TRUE`
    ),
    getActiveBannerCardsByRarity('gg', 'super_rare'),
    pool.query(
      `SELECT cd.id, cd.rarity, cd.base_stat AS "baseStat",
              i.name AS "idolName", i."group"
       FROM card_definitions cd JOIN idols i ON i.id = cd.idol_id
       WHERE cd.rarity = 'super_rare' AND cd.is_active = TRUE`
    ),
  ]);
  const rarePools   = { rare: rareRows.rows };
  const srPool      = eventSrRows.length ? eventSrRows : globalSrRows.rows;

  const cards = [];
  for (let i = 0; i < pullCount; i++) {
    const rarity = Math.random() < srRate ? 'super_rare' : 'rare';
    const pool_  = rarity === 'rare' ? rarePools.rare : srPool;
    if (!pool_.length) continue;

    const def = pool_[Math.floor(Math.random() * pool_.length)];
    const ceiling = RARITY_CEILING[def.rarity];

    // ON CONFLICT DO UPDATE avoids the transaction-visibility issue when the
    // same card is drawn more than once during the same starter pull batch.
    await db.query(
      `INSERT INTO player_cards (user_id, card_def_id, current_stat)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, card_def_id)
       DO UPDATE SET current_stat = LEAST(player_cards.current_stat + 1, $4)`,
      [userId, def.id, def.baseStat, ceiling]
    );

    cards.push({
      cardDefId: def.id,
      idolName: def.idolName,
      group: def.group,
      rarity: def.rarity,
      isNew: true,
      wasUpgrade: false,
      wasOverflow: false,
    });
  }
  // Ticket columns (rare_tickets, sr_tickets, ur_tickets) default to 1 on the users row.
  return cards;
}

// Add a card to a player's collection.
// - New card → insert into player_cards.
// - Duplicate below ceiling → increment stat.
// - Duplicate at ceiling → return wasOverflow:true (overflow insert added in US4/T058).
async function addCardToCollection(userId, cardDefId, client) {
  const def = await getCardDefById(cardDefId);
  if (!def) throw new Error(`card_def ${cardDefId} not found`);
  const ceiling = RARITY_CEILING[def.rarity];

  const existing = await getPlayerCard(userId, cardDefId, client);
  if (!existing) {
    const card = await insertPlayerCard(userId, cardDefId, def.baseStat, client);
    return { isNew: true, wasUpgrade: false, wasOverflow: false, currentStat: card.currentStat };
  }
  if (existing.currentStat < ceiling) {
    const updated = await incrementPlayerCardStat(existing.playerCardId, client);
    return { isNew: false, wasUpgrade: true, wasOverflow: false, currentStat: updated.currentStat };
  }
  // At ceiling — persist as overflow duplicate
  const overflow = await insertOverflowDuplicate(userId, cardDefId, client);
  return { isNew: false, wasUpgrade: false, wasOverflow: true, overflowId: overflow.id, currentStat: existing.currentStat };
}

module.exports = { createStarterCollection, addCardToCollection, RARITY_CEILING };
