# Data Model: Show Multipliers & Scoring Completeness

**Phase**: 1 — Design
**Date**: 2026-06-23
**Feature**: [spec.md](spec.md) | [research.md](research.md)

---

## Schema changes

### New table: `show_schedule_multipliers`

Stores multiplier templates per recurring show schedule. One row = one bonus category for one schedule. Copied into `show_multipliers` when the scheduler creates a new show from its schedule.

```sql
CREATE TABLE IF NOT EXISTS show_schedule_multipliers (
  id               SERIAL PRIMARY KEY,
  schedule_id      INTEGER NOT NULL REFERENCES show_schedules(id) ON DELETE CASCADE,
  label            TEXT NOT NULL,
  multiplier_value NUMERIC NOT NULL CHECK (multiplier_value > 0),
  applies_to_type  TEXT NOT NULL
                     CHECK (applies_to_type IN ('role', 'company', 'same_group')),
  applies_to_value TEXT,
  UNIQUE (schedule_id, applies_to_type, COALESCE(applies_to_value, ''))
);
```

**Notes**:
- `label` is the player-visible string shown on the lineup page (e.g., `"+Rapper"`). Never contains the numeric value.
- `multiplier_value` is system-only and must never be sent to the client.
- `applies_to_value` is `NULL`-tolerant but the seed script always provides a value. For `same_group` homogeneity, use `'any'`; for specific group, use the group name (e.g., `'TWICE'`).
- The unique constraint uses `COALESCE(applies_to_value, '')` so that a NULL and `''` don't create duplicates — practically, the seed script always provides a non-null value.
- `soloist_only` is intentionally excluded from the CHECK constraint (present in `show_multipliers` for legacy reasons but not used in templates).

---

### Modified query: `getPlayerCards` in `backend/db.js`

Add `groupSize` to each player card row via a correlated subquery:

```sql
(SELECT COUNT(*)::int FROM idols i2 WHERE i2."group" = i."group") AS "groupSize"
```

This allows `LineupBuilder.jsx` to compute the chemistry preview client-side without additional API calls.

---

### New `gacha_config` key: `chemistry_max_bonus`

| key | default value | meaning |
|-----|--------------|---------|
| `chemistry_max_bonus` | `0.15` | Maximum fractional score bonus at 100% chemistry (full group). Applied as `score *= (1 + chemistry_ratio × chemistry_max_bonus)`. |

Added to `backend/seed-gacha-config.js` with `ON CONFLICT (key) DO NOTHING` (idempotent).

---

## Unchanged tables

All existing tables (`show_multipliers`, `shows`, `show_schedules`, `lineups`, `lineup_slots`, `player_cards`, `card_definitions`, `idols`, etc.) are unchanged in structure. No column drops, no renames.

The `show_multipliers` table continues to work exactly as before — this feature only adds rows to it (via the new copy-on-create path in the scheduler).

---

## Entity relationships

```
show_schedules (1) ──< show_schedule_multipliers  [new — templates]
    │
    └── (1) ──< shows (1) ──< show_multipliers    [existing — instances]
```

When a show is created from a schedule:
1. Scheduler calls `getOrCreateTodayShow(today, gender, scheduleId, ...)`
2. If the show was newly created, scheduler calls `copyScheduleMultipliers(showId, scheduleId)`
3. `copyScheduleMultipliers` inserts from `show_schedule_multipliers WHERE schedule_id = scheduleId` into `show_multipliers` for the new `showId`

---

## Chemistry bonus — no table

Chemistry is a pure computation from existing data:

- **Input**: `lineup_slots` rows (already fetched during `resolveShow`) carrying `idol.group` for each slot
- **Group sizes**: one-time query at resolution start: `SELECT "group", COUNT(*)::int AS cnt FROM idols GROUP BY "group"`
- **Formula** (see research Decision 3):
  ```
  n = count of same-group cards in lineup
  G = group's total idol count from above map
  chemistry_ratio = n >= G ? 1.0 : (n <= 1 ? 0 : 1 - 0.5^(n-1))
  chemistry_multiplier = 1 + chemistry_ratio × chemistry_max_bonus
  ```
- **Application**: `finalScore = Math.round(multiplied_score × sizeBonus × randomFactor × chemistry_multiplier)`
- **Multi-group rule**: compute chemistry_ratio per group; use the maximum across all groups in the lineup.

No new table, no new column, no migration change required for chemistry.
