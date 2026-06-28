const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('Missing DATABASE_URL'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

const SCHEMA = `
  -- Extend existing tables
  ALTER TABLE idols ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT '{}';
  ALTER TABLE songs ADD COLUMN IF NOT EXISTS member_count INTEGER NOT NULL DEFAULT 1;

  -- 1. users
  CREATE TABLE IF NOT EXISTS users (
    id                     SERIAL PRIMARY KEY,
    username               TEXT UNIQUE NOT NULL,
    email                  TEXT UNIQUE NOT NULL,
    password_hash          TEXT NOT NULL,
    gg_currency            INTEGER NOT NULL DEFAULT 0,
    bg_currency            INTEGER NOT NULL DEFAULT 0,
    last_daily_pull_gg     TIMESTAMPTZ,
    last_daily_pull_bg     TIMESTAMPTZ,
    rare_tickets           INTEGER NOT NULL DEFAULT 1,
    sr_tickets             INTEGER NOT NULL DEFAULT 1,
    ur_tickets             INTEGER NOT NULL DEFAULT 1,
    ur_ticket_refreshed_at TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Ticket columns for databases created before tickets were added
  ALTER TABLE users ADD COLUMN IF NOT EXISTS rare_tickets          INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS sr_tickets            INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS ur_tickets            INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed  BOOLEAN NOT NULL DEFAULT FALSE;

  -- Rename last_free_pack_claimed_* → last_daily_pull_* on existing databases
  ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily_pull_gg TIMESTAMPTZ;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily_pull_bg TIMESTAMPTZ;
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'last_free_pack_claimed_gg'
    ) THEN
      UPDATE users SET last_daily_pull_gg = last_free_pack_claimed_gg WHERE last_daily_pull_gg IS NULL;
      UPDATE users SET last_daily_pull_bg = last_free_pack_claimed_bg WHERE last_daily_pull_bg IS NULL;
      ALTER TABLE users DROP COLUMN last_free_pack_claimed_gg;
      ALTER TABLE users DROP COLUMN last_free_pack_claimed_bg;
    END IF;
  END $$;

  -- 2. card_definitions
  CREATE TABLE IF NOT EXISTS card_definitions (
    id           SERIAL PRIMARY KEY,
    idol_id      INTEGER NOT NULL REFERENCES idols(id),
    rarity       TEXT NOT NULL CHECK (rarity IN ('rare','super_rare','ultra_rare')),
    base_stat    INTEGER NOT NULL CHECK (
                   (rarity = 'rare'        AND base_stat BETWEEN 70 AND 85) OR
                   (rarity = 'super_rare'  AND base_stat BETWEEN 86 AND 95) OR
                   (rarity = 'ultra_rare'  AND base_stat BETWEEN 96 AND 99)
                 ),
    art_path     TEXT,
    border_style TEXT NOT NULL,
    released_at  DATE,
    is_active    BOOLEAN NOT NULL DEFAULT FALSE
  );

  -- 3. player_cards
  CREATE TABLE IF NOT EXISTS player_cards (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    card_def_id  INTEGER NOT NULL REFERENCES card_definitions(id),
    current_stat INTEGER NOT NULL,
    acquired_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, card_def_id)
  );

  -- 4. overflow_duplicates
  CREATE TABLE IF NOT EXISTS overflow_duplicates (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    card_def_id INTEGER NOT NULL REFERENCES card_definitions(id),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- 5. (tickets table replaced by columns on users — see above)
  DROP TABLE IF EXISTS tickets;

  -- 6. gacha_config
  CREATE TABLE IF NOT EXISTS gacha_config (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- 7. banners — no rarity column; ends_at nullable (NULL = permanent)
  CREATE TABLE IF NOT EXISTS banners (
    id              SERIAL PRIMARY KEY,
    group_name      TEXT NOT NULL,
    gender_category TEXT NOT NULL CHECK (gender_category IN ('gg','bg')),
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    description     TEXT
  );

  -- Migrate existing banners tables: drop rarity, make ends_at nullable
  ALTER TABLE banners DROP COLUMN IF EXISTS rarity;
  ALTER TABLE banners ALTER COLUMN ends_at DROP NOT NULL;

  -- 8. banner_cards
  CREATE TABLE IF NOT EXISTS banner_cards (
    banner_id   INTEGER NOT NULL REFERENCES banners(id) ON DELETE CASCADE,
    card_def_id INTEGER NOT NULL REFERENCES card_definitions(id),
    PRIMARY KEY (banner_id, card_def_id)
  );

  -- 9. banner_free_pulls
  CREATE TABLE IF NOT EXISTS banner_free_pulls (
    banner_id            INTEGER NOT NULL REFERENCES banners(id) ON DELETE CASCADE,
    user_id              INTEGER NOT NULL REFERENCES users(id),
    free_pulls_remaining INTEGER NOT NULL DEFAULT 0,
    claimed_at           TIMESTAMPTZ,
    PRIMARY KEY (banner_id, user_id)
  );

  -- 10. pity_counters
  CREATE TABLE IF NOT EXISTS pity_counters (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    gender_category TEXT NOT NULL CHECK (gender_category IN ('gg','bg')),
    target_rarity   TEXT NOT NULL CHECK (target_rarity IN ('super_rare','ultra_rare')),
    pull_count      INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, gender_category, target_rarity)
  );

  -- 11. show_schedules
  CREATE TABLE IF NOT EXISTS show_schedules (
    id              SERIAL PRIMARY KEY,
    day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    gender_category TEXT NOT NULL CHECK (gender_category IN ('gg','bg')),
    show_name       TEXT NOT NULL,
    deadline_time   TIME NOT NULL,
    show_time       TIME NOT NULL,
    timezone        TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    UNIQUE (day_of_week, gender_category)
  );

  -- 12. shows
  CREATE TABLE IF NOT EXISTS shows (
    id                SERIAL PRIMARY KEY,
    schedule_id       INTEGER REFERENCES show_schedules(id),
    date              DATE NOT NULL,
    gender_category   TEXT NOT NULL CHECK (gender_category IN ('gg','bg')),
    show_name         TEXT NOT NULL,
    is_special_event  BOOLEAN NOT NULL DEFAULT FALSE,
    deadline          TIMESTAMPTZ NOT NULL,
    resolution_status TEXT NOT NULL DEFAULT 'pending'
                        CHECK (resolution_status IN ('pending','resolving','resolved')),
    resolved_at       TIMESTAMPTZ,
    UNIQUE (date, gender_category)
  );

  -- 13. show_multipliers
  CREATE TABLE IF NOT EXISTS show_multipliers (
    id               SERIAL PRIMARY KEY,
    show_id          INTEGER NOT NULL REFERENCES shows(id),
    label            TEXT NOT NULL,
    multiplier_value NUMERIC NOT NULL,
    applies_to_type  TEXT NOT NULL
                       CHECK (applies_to_type IN ('role','company','same_group','soloist_only')),
    applies_to_value TEXT
  );

  -- 14. weekly_song_pools
  CREATE TABLE IF NOT EXISTS weekly_song_pools (
    id              SERIAL PRIMARY KEY,
    week_start_date DATE NOT NULL,
    gender_category TEXT NOT NULL CHECK (gender_category IN ('gg','bg')),
    song_id         INTEGER NOT NULL REFERENCES songs(id),
    UNIQUE (week_start_date, gender_category, song_id)
  );

  -- 15. lineups
  CREATE TABLE IF NOT EXISTS lineups (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    gender_category TEXT NOT NULL CHECK (gender_category IN ('gg','bg')),
    song_id         INTEGER NOT NULL REFERENCES songs(id),
    is_valid        BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, gender_category)
  );

  -- 16. lineup_slots
  CREATE TABLE IF NOT EXISTS lineup_slots (
    id             SERIAL PRIMARY KEY,
    lineup_id      INTEGER NOT NULL REFERENCES lineups(id) ON DELETE CASCADE,
    slot_position  INTEGER NOT NULL,
    player_card_id INTEGER NOT NULL REFERENCES player_cards(id),
    UNIQUE (lineup_id, slot_position)
  );

  -- 17. show_entries
  CREATE TABLE IF NOT EXISTS show_entries (
    id               SERIAL PRIMARY KEY,
    show_id          INTEGER NOT NULL REFERENCES shows(id),
    user_id          INTEGER NOT NULL REFERENCES users(id),
    song_id          INTEGER NOT NULL REFERENCES songs(id),
    card_snapshot    JSONB NOT NULL,
    base_score       INTEGER NOT NULL,
    final_score      INTEGER NOT NULL,
    rank             INTEGER,
    reward_rarity    TEXT CHECK (reward_rarity IN ('rare','super_rare','ultra_rare')),
    reward_issued_at TIMESTAMPTZ,
    UNIQUE (show_id, user_id)
  );

  -- Seed permanent daily banners (one per gender category, idempotent)
  INSERT INTO banners (group_name, gender_category, starts_at, ends_at, is_active, description)
  SELECT 'Daily', 'gg', '2000-01-01 00:00:00+00', NULL, TRUE, 'daily'
  WHERE NOT EXISTS (
    SELECT 1 FROM banners WHERE gender_category = 'gg' AND description = 'daily'
  );

  INSERT INTO banners (group_name, gender_category, starts_at, ends_at, is_active, description)
  SELECT 'Daily', 'bg', '2000-01-01 00:00:00+00', NULL, TRUE, 'daily'
  WHERE NOT EXISTS (
    SELECT 1 FROM banners WHERE gender_category = 'bg' AND description = 'daily'
  );

  ALTER TABLE banners ADD COLUMN IF NOT EXISTS subtitle TEXT NULL;
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running card game migration...');
    await client.query('BEGIN');
    await client.query(SCHEMA);
    await client.query('COMMIT');
    console.log('Migration complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
