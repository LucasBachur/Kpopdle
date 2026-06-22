# Data Model: Kpopdle Card Game

**Phase**: 1 — Design
**Date**: 2026-06-14
**Feature**: [spec.md](spec.md) | [research.md](research.md)

---

## Schema Overview

The card game extends the existing PostgreSQL database. Existing tables (`idols`, `songs`, `daily_answers`, `daily_answers_songs`) are unchanged except for two additive column extensions noted below.

---

## As-Built Reconciliation *(2026-06-21)*

The shipped schema (`backend/migrate-card-game.js`) differs from the design below:

- **No `tickets` table.** Tickets are integer columns on `users`: `rare_tickets`, `sr_tickets`, `ur_tickets` (default 1). The migration runs `DROP TABLE IF EXISTS tickets`. The `tickets` section below is historical.
- **`users` has extra columns:** `rare_tickets`, `sr_tickets`, `ur_tickets`, and `onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE`.
- **`card_definitions.art_path` is nullable** (design said NOT NULL).
- **`idols.company` / `idols.group_type` and `songs.group_type` already existed** in the base schema; only `idols.roles` was added here. Scoring multipliers read all three.

## Modifications to Existing Tables

### `idols` — add `roles`

```sql
ALTER TABLE idols ADD COLUMN roles TEXT[] NOT NULL DEFAULT '{}';
```

`roles` stores player-visible role labels used by show multipliers (e.g., `'rapper'`, `'vocalist'`, `'dancer'`, `'maknae'`). Operator-managed. Multiple roles per idol are supported.

### `songs` — add `member_count`

```sql
ALTER TABLE songs ADD COLUMN member_count INTEGER NOT NULL DEFAULT 1;
```

`member_count` defines how many lineup slots a song requires. Operator-managed at insert time.

---

## New Tables

### `users`

Player accounts. Authentication and currency live here.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `username` | TEXT UNIQUE NOT NULL | Display name |
| `email` | TEXT UNIQUE NOT NULL | Login identifier |
| `password_hash` | TEXT NOT NULL | bcrypt hash |
| `gg_currency` | INTEGER NOT NULL DEFAULT 0 | Girl Group pull currency |
| `bg_currency` | INTEGER NOT NULL DEFAULT 0 | Boy Group pull currency |
| `last_daily_pull_gg` | TIMESTAMPTZ | NULL = never used; tracks last daily banner free pull for GG |
| `last_daily_pull_bg` | TIMESTAMPTZ | NULL = never used; tracks last daily banner free pull for BG |
| `ur_ticket_refreshed_at` | TIMESTAMPTZ | Date of last UR ticket issuance; used to compute next refresh |
| `rare_tickets` | INTEGER NOT NULL DEFAULT 1 | As-built — replaces `tickets` table |
| `sr_tickets` | INTEGER NOT NULL DEFAULT 1 | As-built |
| `ur_tickets` | INTEGER NOT NULL DEFAULT 1 | As-built |
| `onboarding_completed` | BOOLEAN NOT NULL DEFAULT FALSE | As-built — gates first-run reveal flow |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

---

### `card_definitions`

Master catalog of every releasable card (one row per idol × rarity × version). This is operator-managed reference data, not per-player.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `idol_id` | INTEGER NOT NULL → `idols(id)` | |
| `rarity` | TEXT NOT NULL | `'rare'`, `'super_rare'`, `'ultra_rare'` |
| `base_stat` | INTEGER NOT NULL | Stat at time of creation; within rarity range |
| `art_path` | TEXT NOT NULL | Relative URL to card art image |
| `border_style` | TEXT NOT NULL | Identifier for the border/frame design |
| `released_at` | DATE | NULL = not yet released |
| `is_active` | BOOLEAN NOT NULL DEFAULT FALSE | Whether acquirable via pulls |

**Constraint**: `base_stat` must be within the rarity range (enforced via CHECK):
- `rare`: 70–85
- `super_rare`: 86–95
- `ultra_rare`: 96–99

---

### `player_cards`

Each row is one card owned by one player. Tracks current stat (modified by upgrades).

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `user_id` | INTEGER NOT NULL → `users(id)` | |
| `card_def_id` | INTEGER NOT NULL → `card_definitions(id)` | |
| `current_stat` | INTEGER NOT NULL | Starts at `base_stat`; increases with upgrades |
| `acquired_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

**Unique constraint**: `(user_id, card_def_id)` — a player owns at most one instance of each card definition. Duplicates are handled via the `overflow_duplicates` table.

---

### `overflow_duplicates`

Duplicate cards received after a player already owns the card definition at its rarity ceiling. Held in inventory until the player acts.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `user_id` | INTEGER NOT NULL → `users(id)` | |
| `card_def_id` | INTEGER NOT NULL → `card_definitions(id)` | |
| `received_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

Multiple rows with the same `(user_id, card_def_id)` are allowed — each represents one overflow duplicate.

---

### `tickets` *(NOT BUILT — see As-Built Reconciliation; replaced by integer columns on `users`)*

One-time redemption tickets issued at account creation. UR ticket refreshes annually.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `user_id` | INTEGER NOT NULL → `users(id)` | |
| `rarity` | TEXT NOT NULL | `'rare'`, `'super_rare'`, `'ultra_rare'` |
| `redeemed_at` | TIMESTAMPTZ | NULL = not yet redeemed |
| `redeemed_for_card_def_id` | INTEGER → `card_definitions(id)` | The card chosen at redemption |
| `issued_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

Each user starts with 3 tickets (one per rarity). The UR ticket row is replaced (or a new row inserted) on annual refresh.

---

### `gacha_config`

System-wide configurable parameters. All numeric tuning values live here.

| Column | Type | Notes |
|--------|------|-------|
| `key` | TEXT PK | Config key (see research.md for full list) |
| `value` | JSONB NOT NULL | Value (number, array, or object) |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

---

### `banners`

Pull banners per group — time-limited or permanent. Each banner covers all three rarities simultaneously; which cards are available per rarity is determined by `banner_cards`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `group_name` | TEXT NOT NULL | The Kpop group this banner features |
| `gender_category` | TEXT NOT NULL | `'gg'` or `'bg'` |
| `starts_at` | TIMESTAMPTZ NOT NULL | |
| `ends_at` | TIMESTAMPTZ | NULL = permanent (daily banner and other always-on banners) |
| `is_active` | BOOLEAN NOT NULL DEFAULT FALSE | |
| `description` | TEXT | Optional operator note (comeback name, milestone, or `'daily'`) |

Which card definitions appear on a banner — and at which rarity — is managed via the `banner_cards` join table. The player's Rate Up selection is ephemeral (not persisted on the banner) — it's captured at pull time. Rarity of each pull is determined by gacha rates in `gacha_config`, not by a banner-level rarity field.

---

### `banner_cards`

Join table linking banners to the card definitions available on them. A banner may include cards of any rarity; at pull time, the rolled rarity filters to matching entries from this table.

| Column | Type | Notes |
|--------|------|-------|
| `banner_id` | INTEGER NOT NULL → `banners(id)` ON DELETE CASCADE | |
| `card_def_id` | INTEGER NOT NULL → `card_definitions(id)` | |

**Primary key**: `(banner_id, card_def_id)`.

---

### `banner_free_pulls`

Per-player, per-banner free pull grants. Consumed before currency on every pull interaction.

| Column | Type | Notes |
|--------|------|-------|
| `banner_id` | INTEGER NOT NULL → `banners(id)` ON DELETE CASCADE | |
| `user_id` | INTEGER NOT NULL → `users(id)` | |
| `free_pulls_remaining` | INTEGER NOT NULL DEFAULT 0 | Decremented per pull; 0 = exhausted |
| `claimed_at` | TIMESTAMPTZ | NULL = grant not yet started; set on first claim interaction |

**Primary key**: `(banner_id, user_id)`.

**Note**: Daily banner free pulls are NOT tracked here — they reset daily and are tracked via `users.last_daily_pull_gg` / `_bg`. This table is for one-time or event-specific grants tied to a specific banner.

---

### `pity_counters`

Tracks consecutive pulls without a high-rarity result, per user per banner rarity per gender category.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `user_id` | INTEGER NOT NULL → `users(id)` | |
| `gender_category` | TEXT NOT NULL | `'gg'` or `'bg'` |
| `target_rarity` | TEXT NOT NULL | `'super_rare'` or `'ultra_rare'` |
| `pull_count` | INTEGER NOT NULL DEFAULT 0 | Resets to 0 after a qualifying pull |

**Unique constraint**: `(user_id, gender_category, target_rarity)`.

---

### `show_schedules`

Weekly recurring show definitions. One row per day-of-week per gender category.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `day_of_week` | INTEGER NOT NULL | 0=Sunday … 6=Saturday |
| `gender_category` | TEXT NOT NULL | `'gg'` or `'bg'` |
| `show_name` | TEXT NOT NULL | e.g., `'Music Bank'`, `'Show Champion'` |
| `deadline_time` | TIME NOT NULL | Wall-clock time of the deadline in `timezone` (e.g., `18:45:00`) |
| `show_time` | TIME NOT NULL | Wall-clock time the show "airs" in `timezone` (e.g., `19:00:00`) |
| `timezone` | TEXT NOT NULL DEFAULT `'America/Argentina/Buenos_Aires'` | IANA timezone name; used when converting `deadline_time`/`show_time` to absolute TIMESTAMPTZ |

**Unique constraint**: `(day_of_week, gender_category)`.

When the scheduler creates a `shows` row for a given date, it combines `deadline_time` + `timezone` (e.g., `2026-06-14 18:45:00 America/Argentina/Buenos_Aires`) to compute the `deadline` TIMESTAMPTZ stored on `shows`. All stored timestamps are UTC; the timezone column is only consulted at show creation time.

---

### `shows`

Each daily show instance. Created by the scheduler at the start of each day (or in advance).

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `schedule_id` | INTEGER → `show_schedules(id)` | NULL for special events |
| `date` | DATE NOT NULL | The calendar date of this show |
| `gender_category` | TEXT NOT NULL | `'gg'` or `'bg'` |
| `show_name` | TEXT NOT NULL | Copied from schedule, or event name |
| `is_special_event` | BOOLEAN NOT NULL DEFAULT FALSE | |
| `deadline` | TIMESTAMPTZ NOT NULL | Exact UTC timestamp when lineup submission closes; computed from `show_schedules.deadline_time` + `show_schedules.timezone` at show creation |
| `resolution_status` | TEXT NOT NULL DEFAULT `'pending'` | `'pending'`, `'resolving'`, `'resolved'` |
| `resolved_at` | TIMESTAMPTZ | |

**Unique constraint**: `(date, gender_category)`.

---

### `show_multipliers`

Multiplier bonuses applied during score calculation for a specific show.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `show_id` | INTEGER NOT NULL → `shows(id)` | |
| `label` | TEXT NOT NULL | Player-visible category name (e.g., `'+Rapper'`, `'++JYP'`) |
| `multiplier_value` | NUMERIC NOT NULL | System-only numeric multiplier (e.g., `1.2`, `1.5`) |
| `applies_to_type` | TEXT NOT NULL | `'role'`, `'company'`, `'same_group'`, `'soloist_only'` |
| `applies_to_value` | TEXT | For `role`: `'rapper'`; for `company`: `'JYP'`; NULL for `same_group`/`soloist_only` |

---

### `weekly_song_pools`

Songs available to players for lineup selection in a given week.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `week_start_date` | DATE NOT NULL | Monday of the week |
| `gender_category` | TEXT NOT NULL | `'gg'` or `'bg'` |
| `song_id` | INTEGER NOT NULL → `songs(id)` | |

**Unique constraint**: `(week_start_date, gender_category, song_id)`.

---

### `lineups`

A player's active team configuration per gender category. At most one active lineup per `(user_id, gender_category)`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `user_id` | INTEGER NOT NULL → `users(id)` | |
| `gender_category` | TEXT NOT NULL | `'gg'` or `'bg'` |
| `song_id` | INTEGER NOT NULL → `songs(id)` | The chosen song |
| `is_valid` | BOOLEAN NOT NULL DEFAULT TRUE | FALSE if song no longer in current week's pool |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

**Unique constraint**: `(user_id, gender_category)`.

---

### `lineup_slots`

Individual card assignments within a lineup.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `lineup_id` | INTEGER NOT NULL → `lineups(id)` ON DELETE CASCADE | |
| `slot_position` | INTEGER NOT NULL | 1-indexed; max = `songs.member_count` |
| `player_card_id` | INTEGER NOT NULL → `player_cards(id)` | |

**Unique constraint**: `(lineup_id, slot_position)`.

---

### `show_entries`

Records each player's participation in a show. Created at resolution time from the player's active lineup.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `show_id` | INTEGER NOT NULL → `shows(id)` | |
| `user_id` | INTEGER NOT NULL → `users(id)` | |
| `song_id` | INTEGER NOT NULL → `songs(id)` | Snapshot of the song at resolution |
| `card_snapshot` | JSONB NOT NULL | Snapshot of cards used (id, stat, idol name, rarity) |
| `base_score` | INTEGER NOT NULL | Sum of card stats at resolution |
| `final_score` | INTEGER NOT NULL | After multipliers, size bonus, random factor |
| `rank` | INTEGER | Populated after all scores computed |
| `reward_rarity` | TEXT | `'rare'`, `'super_rare'`, `'ultra_rare'` — NULL until distributed |
| `reward_issued_at` | TIMESTAMPTZ | NULL until currency credited |

**Unique constraint**: `(show_id, user_id)`.

**Why `card_snapshot`**: The lineup can change after a show resolves. The snapshot preserves the exact cards used for the leaderboard display.

---

## Entity Relationship Summary

```
users ──< player_cards >── card_definitions >── idols
users ──< overflow_duplicates >── card_definitions
users ──< tickets
users ──< pity_counters
users ──< lineups ──< lineup_slots >── player_cards
users ──< show_entries >── shows

shows >── show_schedules
shows ──< show_multipliers

banners ──< banner_cards >── card_definitions
users ──< banner_free_pulls >── banners

weekly_song_pools >── songs
lineups >── songs
songs : has member_count

gacha_config : global key-value config (no FK relationships)
```

---

## State Machines

### Show Resolution Status
```
pending → resolving → resolved
```
- `pending`: Show created, accepting lineup submissions up to deadline.
- `resolving`: Scheduler has begun score calculation. No new entries accepted.
- `resolved`: All scores computed, ranks assigned, rewards distributed, leaderboard finalized.

### Lineup Validity
```
valid → invalid (when weekly pool changes and song no longer in pool)
invalid → valid (when player updates lineup to a valid song)
```

### Ticket Status
```
issued (redeemed_at IS NULL) → redeemed (redeemed_at SET)
```
UR ticket: after redemption, a new ticket row is created after 365 days.
