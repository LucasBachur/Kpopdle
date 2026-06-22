# Research: Weekly Song Pool & Rotation

**Phase**: 0 — Outline & Research
**Date**: 2026-06-21
**Feature**: [spec.md](spec.md) | [plan.md](plan.md)

All spec `[NEEDS CLARIFICATION]` items were resolved during the 2026-06-21 clarification session (see spec § Clarifications). The decisions below resolve the remaining *implementation* unknowns surfaced while reading the existing feature-001 code.

---

## Decision 1 — Song eligibility definition

**Decision**: An eligible song for gender category `c` is a row in `songs` where `group_type = c` AND `member_count >= 1`. Selection joins only against `songs`; no new flag column is added.

**Rationale**: The spec defines an eligible song as one "that has a member count set" because `member_count` determines the required lineup slots. In the as-built schema (`migrate-card-game.js`), `songs.member_count` is `INTEGER NOT NULL DEFAULT 1` and `songs.group_type` already distinguishes `'gg'`/`'bg'`. There is no separate "eligible" flag, and the spec's Assumptions explicitly make eligibility curation an **operator responsibility** ("the operator curates which of those groups' songs are eligible"). The operator controls eligibility by which songs exist in the catalog and by setting realistic member counts. The selection query therefore filters by gender and a present member count rather than inventing a new column (which would be a schema change — out of scope).

**Alternatives considered**:
- *Add an `is_eligible` boolean to `songs`* — rejected: the spec forbids schema changes for this feature, and group/member-count curation already expresses eligibility.
- *Treat only `member_count > 1` as eligible* — rejected: solo-performed songs (count 1) are still valid pool entries; the gating signal is "set," and NOT NULL means it is always set.

---

## Decision 2 — Selection algorithm (random with last-week avoidance)

**Decision**: To build a pool for week `W`, gender `c`, target size `N`:

1. `eligible` = all eligible songs for `c` (Decision 1).
2. `lastWeek` = song ids in the pool for week `W − 7 days`, gender `c` (empty if none).
3. `fresh` = `eligible \ lastWeek`.
4. Shuffle `fresh`; take the first `min(N, |fresh|)`.
5. If still short of `N`, shuffle `eligible ∩ lastWeek` and append until `N` is reached (previous-week reuse).
6. If `|eligible| < N`, the pool is all of `eligible` and the run records an **under-target** condition (count selected vs. `N`).
7. If `|eligible| == 0`, **no pool is created** and any existing pool is left untouched.

Shuffle uses a Fisher–Yates over the in-memory id array (catalog is small; no need for SQL `ORDER BY random()`).

**Rationale**: Directly satisfies FR-006 (prefer not-last-week, reuse only as needed), FR-008 (under-target instead of failure), FR-009 (empty catalog is a no-op that preserves the last good pool), and the SC-005 guarantee (zero overlap when enough fresh songs exist; reach size by reuse otherwise). Repeats from *earlier* weeks (2+ weeks back) are naturally allowed because avoidance only looks one week back, matching the clarification.

**Alternatives considered**:
- *`ORDER BY random() LIMIT N` in SQL* — rejected: harder to express the two-tier fresh-then-reuse fill and the under-target reporting in one query; the catalog is tiny so app-side shuffle is clearer and testable.
- *Global "never repeat" history* — rejected: the clarification explicitly allows repeats from earlier weeks; only the immediately previous week is avoided.

---

## Decision 3 — Week anchoring (Monday, ART)

**Decision**: Reuse the existing `getMonday(date)` helper in `backend/db.js`, which already returns the ART Monday as `YYYY-MM-DD`. The previous week is `getMonday()` minus 7 days (computed on a date offset, then re-anchored). `weekly_song_pools.week_start_date` stores this Monday date.

**Rationale**: The core game already anchors weeks to ART Monday via `getMonday()`, and `getCurrentWeekSongs()` reads with it. Reusing it guarantees the establishment/rotation writes land on exactly the date the read path queries, and keeps a single definition of "the week." The scheduler already uses ART (`America/Argentina/Buenos_Aires`) and the UTC-3 offset for show creation, so the time model is consistent.

**Alternatives considered**: A new week-math helper — rejected as duplication and a divergence risk against the read path.

---

## Decision 4 — Idempotency & "establish vs. rotate" unification

**Decision**: One function `ensureWeeklyPool(weekStart, genderCategory)` is the single writer. It checks whether any `weekly_song_pools` row exists for `(weekStart, genderCategory)`; if so it returns "already present, unchanged" and writes nothing. Otherwise it runs Decision 2 and inserts the chosen rows inside a transaction. Establishment (operator script) and rotation (cron) both call it — establishment for the current week, rotation for the current week at the boundary. Inserts also use `ON CONFLICT (week_start_date, gender_category, song_id) DO NOTHING` as a belt-and-suspenders guard against concurrent runs.

**Rationale**: Satisfies FR-002 and FR-007 (idempotent per week) with one code path, eliminating drift between the operator and scheduled flows. The existence check (not just `ON CONFLICT`) guarantees an *existing* pool is never partially altered even if the eligible catalog changed mid-week.

**Alternatives considered**: Separate establish/rotate implementations — rejected: two selection code paths invite divergence in the avoidance/under-target rules.

---

## Decision 5 — Scheduling & catch-up

**Decision**: Add to `scheduler.js`:
- `cron.schedule('0 3 * * 1', rotateAllGenders, { timezone: 'UTC' })` — Monday 03:00 UTC = Monday 00:00 ART.
- A startup call to `rotateAllGenders()` (alongside the existing startup `createTodayShows()`), so a server that was down at the boundary or restarts mid-week catches up the **current** week's pool.

`rotateAllGenders()` calls `ensureWeeklyPool(getMonday(), gender)` for each gender in scope (`['gg']` surfaced; `'bg'` optionally formed for schema completeness, never surfaced), then runs lineup invalidation per gender. Because `ensureWeeklyPool` is idempotent and always targets the *current* ART Monday, "late or twice" runs are safe (FR-010).

**Rationale**: Mirrors the established scheduler pattern (cron + startup catch-up) used for shows. Targeting "current Monday" rather than a stored "next run" timestamp means a missed boundary self-heals on the next startup or the next minute the process is alive, with no extra bookkeeping table.

**Alternatives considered**:
- *A persisted "last rotation" cursor* — rejected: unnecessary state; idempotent current-week targeting already gives catch-up for free.
- *Run invalidation only in cron, not on establishment* — rejected: establishment can also change the offered set on first creation, so invalidation runs after every `ensureWeeklyPool` that created/already-has a pool.

---

## Decision 6 — Lineup invalidation scope

**Decision**: After a pool exists for `(weekStart, c)`, run a single bulk update:
`UPDATE lineups SET is_valid = FALSE WHERE gender_category = c AND song_id NOT IN (<song ids in the week's pool>)`.
In-pool lineups are left exactly as they are (no write). Re-validation is **not** handled here — it already happens in `upsertLineup` (which sets `is_valid = TRUE` on save), satisfying FR-013 without new code.

**Rationale**: FR-011 flags only out-of-pool lineups; FR-012 forbids touching in-pool ones. A `NOT IN (pool)` update touches exactly the stale rows. The core already re-validates on save, so this feature must only *set the invalid flag*, preserving the existing valid→invalid→valid state machine.

**Alternatives considered**: Recomputing `is_valid` for all lineups (set TRUE for in-pool) — rejected: writes to rows the spec says must remain unchanged and risks clobbering a future independent validity meaning.

---

## Decision 7 — Pool size configuration

**Decision**: Add `weekly_pool_size = 25` to `seed-gacha-config.js` and read it via the existing `gacha_config` accessor at run time, with a hardcoded fallback of `25` if the key is absent.

**Rationale**: The spec (FR-001/005, Assumptions) wants the size read from configuration "where practical," and the core already centralizes tunables in `gacha_config`. The fallback keeps establishment working on a database seeded before this key was added.

**Alternatives considered**: A hardcoded constant — rejected: contradicts the config-driven tuning principle the core established.

---

## Decision 8 — BG scope guard

**Decision**: No player-facing endpoint change is needed. `GET /songs/weekly` is already gender-scoped and the UI requests only `gg`. Forming a `'bg'` pool is optional and, if done, is never returned because no GG-launch surface queries `bg`. The establishment script defaults to `gg` only.

**Rationale**: Satisfies FR-014 / SC-008 by construction — the existing read path cannot leak a BG pool into a GG response, and nothing surfaces BG.

**Alternatives considered**: Explicitly skipping BG entirely — acceptable, but allowing an optional hidden BG pool matches the spec's "schema completeness" allowance at zero player-facing risk.
