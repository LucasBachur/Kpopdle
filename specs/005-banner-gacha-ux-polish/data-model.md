# Data Model: Banner & Gacha UX Polish

## Schema Changes

### 1. `banners` — add `subtitle` column

```sql
ALTER TABLE banners ADD COLUMN IF NOT EXISTS subtitle TEXT NULL;
```

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `subtitle` | `TEXT` | YES | Operator-set display text shown below the banner title on the Banners page. NULL means no subtitle is shown. |

**Existing columns unchanged**: `id`, `group_name`, `gender_category`, `starts_at`, `ends_at`, `is_active`, `description`.

`description` continues to serve as a type discriminator (`'daily'` = permanent daily banner). It is never shown as display text to players.

---

## No-Change Tables (used but not modified)

### `banner_free_pulls`

No schema change. Existing schema:

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | `INTEGER FK → users.id` | Player |
| `banner_id` | `INTEGER FK → banners.id` | Banner |
| `free_pulls_remaining` | `INTEGER` | Remaining grant count |
| `claimed_at` | `TIMESTAMPTZ` | Timestamp of first claim (NULL until first use) |

**Behavioral change (FR-004)**: The read of `free_pulls_remaining` before consumption is moved inside the existing transaction with `SELECT ... FOR UPDATE`. No column additions.

**Operator grant flow**: Operators set `free_pulls_remaining` via direct `INSERT ... ON CONFLICT DO UPDATE` into `banner_free_pulls`:

```sql
INSERT INTO banner_free_pulls (user_id, banner_id, free_pulls_remaining)
VALUES (<player_id>, <banner_id>, <grant_count>)
ON CONFLICT (user_id, banner_id)
DO UPDATE SET free_pulls_remaining = <grant_count>;
```

---

### `banner_cards`

No schema change. Used as-is for the daily banner's card pool (FR-015/FR-016/FR-017).

| Column | Type | Description |
|--------|------|-------------|
| `banner_id` | `INTEGER FK → banners.id` | The banner this card belongs to |
| `card_def_id` | `INTEGER FK → card_definitions.id` | The card available on that banner |

**Operator daily pool setup**: Insert rows linking the daily banner's `id` to the desired `card_def_id` values:

```sql
-- Find the daily banner IDs
SELECT id, gender_category FROM banners WHERE description = 'daily';

-- Add cards to daily banner pool
INSERT INTO banner_cards (banner_id, card_def_id) VALUES (<daily_banner_id>, <card_def_id>);
```

---

### `lineups`

No schema change. `is_valid` column is read to determine auto-entry status (FR-012/FR-013).

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | `INTEGER FK → users.id` | Player |
| `gender_category` | `TEXT` | `'gg'` or `'bg'` |
| `song_id` | `INTEGER FK → songs.id` | Song selected for the lineup |
| `is_valid` | `BOOLEAN` | `TRUE` when the lineup would auto-enter; `FALSE` when invalidated (song removed from weekly pool) |
| `updated_at` | `TIMESTAMPTZ` | Last modification time |

**Auto-entry validity rule**: A lineup row with `is_valid = TRUE` passes the same check the scheduler uses (`showService.js:109`). This is the single source of truth for FR-013.

---

## Entity Relationships (affected paths)

```
banners (1) ──── (N) banner_cards ──── (N) card_definitions
   │
   └── (1) ─── (N) banner_free_pulls ──── (N) users

users (1) ──── (1-per-gender) lineups ──── (1) songs
```

---

## Migration Script Location

`backend/migrate-card-game.js` — append the `ALTER TABLE` for `subtitle` at the end of the existing migration block, wrapped in `IF NOT EXISTS` for idempotency.
