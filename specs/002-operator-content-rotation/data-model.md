# Data Model: Weekly Song Pool & Rotation

**Phase**: 1 — Design
**Date**: 2026-06-21
**Feature**: [spec.md](spec.md) | [research.md](research.md)

---

## Schema changes

**None.** This feature changes no tables, columns, constraints, or indexes. Every table it reads or writes was created by feature 001's `backend/migrate-card-game.js`. The only persisted configuration addition is one `gacha_config` **row** (data, not schema) — see "Configuration" below.

See [`001-idol-card-game/data-model.md`](../001-idol-card-game/data-model.md) for the authoritative column definitions. The relevant entities are summarized here for how *this* feature uses them.

---

## Entities used

### `weekly_song_pools` *(written by this feature)*

The set of songs offered for lineup selection in a given week for a gender category.

| Column | Type | This feature's use |
|--------|------|--------------------|
| `id` | SERIAL PK | — |
| `week_start_date` | DATE | ART Monday from `getMonday()`. One pool = all rows sharing this date + gender. |
| `gender_category` | TEXT | `'gg'` (surfaced) or `'bg'` (optional, hidden). |
| `song_id` | INTEGER → `songs(id)` | One row per song in the week's pool. |

**Unique constraint**: `(week_start_date, gender_category, song_id)` — used as the idempotency guard for inserts (`ON CONFLICT DO NOTHING`).

**Write rules**:
- A pool is "established" by inserting `weekly_pool_size` rows (or fewer, if under-target) for one `(week_start_date, gender_category)`.
- A pool is never partially mutated: if any row exists for the pair, the writer makes no changes (existence check before insert).

### `songs` *(read-only)*

| Column | This feature's use |
|--------|--------------------|
| `id` | Pool membership. |
| `group_type` | Eligibility filter by gender (`'gg'`/`'bg'`). |
| `member_count` | Eligibility signal (present, `>= 1`) and required lineup slot count (already consumed by the lineup save path). |

**Eligible song** (derived, not a column): `group_type = <gender>` AND `member_count >= 1`. See research Decision 1.

### `idols` *(read-only)*

| Column | This feature's use |
|--------|--------------------|
| `id`, `name` | Reporting which idols lack roles. |
| `roles` | `TEXT[] NOT NULL DEFAULT '{}'`. An idol is "missing role tags" when `roles = '{}'` (empty array). The confirmation step **reports** these; it never writes `roles`. |

### `lineups` *(updated by this feature)*

| Column | This feature's use |
|--------|--------------------|
| `user_id`, `gender_category`, `song_id` | Identify the saved lineup and its song. |
| `is_valid` | Set to `FALSE` for lineups whose `song_id` is not in the new pool. In-pool lineups untouched. Re-validation to `TRUE` happens in the existing `upsertLineup`. |

### `gacha_config` *(read-only here; one row seeded)*

Key-value tuning store. This feature reads `weekly_pool_size`.

---

## Configuration

One new default row added to `seed-gacha-config.js` (idempotent `ON CONFLICT (key) DO NOTHING`):

| key | value | Meaning |
|-----|-------|---------|
| `weekly_pool_size` | `25` | Number of songs per weekly pool per gender category (core FR-022). Read at run time; falls back to `25` if absent. |

---

## Derived / in-memory structures (not persisted)

### Pool selection result

Returned by the selection function and surfaced in the operator summary:

```
{
  weekStartDate: 'YYYY-MM-DD',
  genderCategory: 'gg',
  targetSize: 25,
  selected: [songId, ...],      // chosen ids, length <= targetSize
  freshCount: <int>,            // from songs not in last week
  reusedCount: <int>,           // previous-week songs reused to fill
  underTarget: <bool>,          // true when |eligible| < targetSize
  created: <bool>               // false when an existing pool was left unchanged
}
```

### Role-tag confirmation report

```
{
  totalIdols: <int>,
  missingRoles: [ { id, name }, ... ]   // idols with roles = '{}'
}
```

---

## State transitions

### Weekly pool (per `(week_start_date, gender_category)`)

```
absent ──ensureWeeklyPool──> present (immutable for the week)
present ──ensureWeeklyPool (re-run)──> present (no change; idempotent)
absent + no eligible songs ──ensureWeeklyPool──> absent (no-op; last good pool preserved elsewhere)
```

### Lineup validity (unchanged state machine; this feature drives the first edge)

```
valid ──rotation: song left new pool──> invalid     (FR-011, this feature)
valid ──rotation: song still in pool──> valid        (FR-012, no write)
invalid ──player saves in-pool song (upsertLineup)──> valid   (FR-013, pre-existing)
```

---

## Entity relationship (scope of this feature)

```
gacha_config[weekly_pool_size] ──tunes──> selection

songs (group_type, member_count) ──eligible──┐
weekly_song_pools[week-1]  ──avoid──────────┤──> ensureWeeklyPool ──writes──> weekly_song_pools[week]
                                             │
weekly_song_pools[week] ──defines pool──> invalidateStaleLineups ──updates──> lineups.is_valid

idols.roles ──read-only──> confirm-idol-roles report
```
