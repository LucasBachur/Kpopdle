---
description: "Task list for Weekly Song Pool & Rotation"
---

# Tasks: Weekly Song Pool & Rotation

**Input**: Design documents from `/specs/002-operator-content-rotation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/operator-cli.md, contracts/scheduler.md, quickstart.md

**Tests**: No automated test framework is in place (consistent with feature 001). Per the spec, validation is via the `quickstart.md` manual scenarios — **no test tasks are generated**.

**Organization**: Tasks are grouped by user story. US1 and US2 are both P1; US3 is P2. The shared selection writer (`ensureWeeklyPool`) is foundational because both P1 stories depend on it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are relative to the repository root (`D:\Kpopdle`)

## Path Conventions

Backend-only feature (no frontend changes). All work lands under `backend/`:
- Core logic: `backend/services/weeklyPoolService.js` (new)
- Queries: `backend/db.js` (existing)
- Operator scripts: `backend/establish-weekly-pool.js`, `backend/confirm-idol-roles.js` (new)
- Scheduling: `backend/scheduler.js` (existing)
- Config seed: `backend/seed-gacha-config.js` (existing)

Gender codes: `gg` = Girl Group, `bg` = Boy Group.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the environment the feature runs against (no new dependencies — `pg`, `node-cron`, `dotenv` already installed).

- [X] T001 Confirm `DATABASE_URL` is set in `backend/.env` and the card-game schema exists by running `node backend/migrate-card-game.js` (idempotent) from the repo root; confirm `weekly_song_pools`, `songs`, `idols`, `lineups`, and `gacha_config` are present.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared config, queries, and the single pool writer that BOTH P1 user stories (US1 establish, US2 rotate) call. No story work can begin until this phase is complete.

**⚠️ CRITICAL**: US1 and US2 both depend on `ensureWeeklyPool`. Complete this phase first.

- [X] T002 Add the `weekly_pool_size = 25` default row to `backend/seed-gacha-config.js` using an idempotent `INSERT ... ON CONFLICT (key) DO NOTHING`, matching the existing seed entries' shape (research Decision 7, data-model "Configuration").
- [X] T003 Add a `getPoolSize()` accessor to `backend/db.js` that reads `weekly_pool_size` from `gacha_config` and returns the integer value, falling back to `25` when the key is absent; export it from `module.exports` (research Decision 7).
- [X] T004 Add the pool-selection read queries to `backend/db.js` and export them: `getEligibleSongIds(genderCategory)` → ids of `songs` where `group_type = $1 AND member_count >= 1`. **Note: with the as-built schema (`member_count NOT NULL DEFAULT 1`) this predicate is effectively gender-scoping; real eligibility curation is the operator's responsibility via catalog membership (research Decision 1).** `getWeekPoolSongIds(weekStart, genderCategory)` → song ids in `weekly_song_pools` for that week/gender (used for both last-week avoidance and the invalidation pool set) (research Decisions 1, 2, 3; data-model `songs`, `weekly_song_pools`).
- [X] T005 Add the pool write helpers to `backend/db.js` and export them: `weekPoolExists(weekStart, genderCategory)` → boolean existence check, and `insertWeekPoolRows(weekStart, genderCategory, songIds)` → bulk insert wrapped in a transaction using `ON CONFLICT (week_start_date, gender_category, song_id) DO NOTHING` (research Decision 4; data-model `weekly_song_pools` write rules).
- [X] T006 Create `backend/services/weeklyPoolService.js` with a Fisher–Yates `shuffle(array)` helper and `selectPoolSongs({ eligible, lastWeek, targetSize })` implementing the two-tier fresh-then-reuse algorithm and returning `{ selected, freshCount, reusedCount, underTarget }` (research Decision 2; data-model "Pool selection result").
- [X] T007 Implement `ensureWeeklyPool(weekStart, genderCategory)` in `backend/services/weeklyPoolService.js`: (1) read target size via `getPoolSize()`; (2) if `weekPoolExists(weekStart, gender)` → return `{ created: false, ... }` unchanged (FR-002, FR-007); (3) load `eligible = getEligibleSongIds(gender)` — if empty, return a no-op result creating nothing and **skip insertion** (FR-009); (4) **compute the previous ART Monday as `getMonday(weekStart − 7 days)` (re-anchored) and load `lastWeek = getWeekPoolSongIds(prevWeek, gender)`**; (5) call `selectPoolSongs({ eligible, lastWeek, targetSize })`; (6) insert via `insertWeekPoolRows(weekStart, gender, selected)`; (7) return the full result including `weekStartDate`, `genderCategory`, `created`, `targetSize`, `selected`, `freshCount`, `reusedCount`, `underTarget` (research Decisions 1–4; contracts/scheduler.md `ensureWeeklyPool` contract; data-model "Pool selection result" + state transitions).

**Checkpoint**: `ensureWeeklyPool` is callable and idempotent — US1 and US2 can now proceed (in parallel if staffed).

---

## Phase 3: User Story 1 - Operator establishes a playable weekly pool (Priority: P1) 🎯 MVP

**Goal**: An operator runs documented scripts to create the current week's GG pool (idempotently) and to report idols missing role tags, making the game playable end-to-end for a new player.

**Independent Test**: Against a DB with idols, eligible songs, and a card catalog but no weekly pool, run the two scripts, then register a new player and confirm they see a full pool on the lineup screen and can save a valid lineup — no further operator action. (quickstart Scenarios 1 & 2.)

### Implementation for User Story 1

- [X] T008 [US1] Add `getIdolsMissingRoles()` to `backend/db.js` (and export): return `id, name` for idols where `roles = '{}'`, plus a total idol count; read-only, never writes `roles` (FR-003; data-model `idols`; data-model "Role-tag confirmation report").
- [X] T009 [P] [US1] Create `backend/confirm-idol-roles.js`: open its own `pg` Pool from `DATABASE_URL`, call `getIdolsMissingRoles()`, print total count + each missing idol's `{ id, name }` (or an "all idols have roles" message), `await pool.end()`, exit `0` on success / `1` on failure (contracts/operator-cli.md §2; FR-003; US1-4). (`[P]` is relative to T010, a different file; T009 still requires T008 first.)
- [X] T010 [US1] Create `backend/establish-weekly-pool.js`: parse optional `gg|bg` arg (default `gg`), resolve current ART Monday via `getMonday()`, call `ensureWeeklyPool(weekStart, gender)`, and print the human-readable summary required by the contract — target size (note fallback if used), created vs. already-present, selected/fresh/reused counts, explicit under-target warning with both numbers, explicit no-eligible-songs notice; `await pool.end()`, exit `0` when a pool is present after the run (including the no-eligible no-op) / `1` on unexpected failure (contracts/operator-cli.md §1; FR-001, FR-002, FR-004, FR-008, FR-009; US1-1, US1-3). (Lineup invalidation is wired into this script by T014; US1 ships without it.)

**Checkpoint**: A new player can reach a full lineup screen and save a valid lineup. MVP is demonstrable (quickstart Scenarios 1 & 2).

---

## Phase 4: User Story 2 - Weekly song pool rotates automatically (Priority: P1)

**Goal**: At the start of each ART week the pool refreshes automatically (Monday 00:00 ART), preferring not-last-week songs, with startup catch-up so a missed boundary self-heals.

**Independent Test**: With a last-week pool in place, trigger rotation for the current week and confirm a fresh current-week pool exists at size, contains only eligible songs, prefers fresh songs (zero overlap when enough exist), and the prior week's rows are preserved. (quickstart Scenarios 3, 4, 5.)

### Implementation for User Story 2

- [X] T011 [US2] Add `rotateAllGenders()` to `backend/scheduler.js`: define `ROTATED_GENDERS` (`['gg']`, optionally `'bg'`) for the rotation loop and keep player-facing surfacing scoped to `'gg'` only, iterate calling `ensureWeeklyPool(getMonday(), gender)` inside a per-gender try/catch so one gender's failure does not abort the others, and `console.log` the result per gender (created vs. already-present, selected/fresh/reused, under-target) in the existing scheduler log style (contracts/scheduler.md entry point + logging + failure isolation; FR-005–FR-008, FR-010).
- [X] T012 [US2] Register the rotation schedule in `backend/scheduler.js`: `cron.schedule('0 3 * * 1', rotateAllGenders, { timezone: 'UTC' })` (Monday 03:00 UTC = 00:00 ART) and add a startup call to `rotateAllGenders()` alongside the existing `createTodayShows()` startup call so a missed boundary catches up (research Decision 5; contracts/scheduler.md schedule; FR-005, FR-010, SC-004, SC-007).

**Checkpoint**: Rotation runs on schedule and at startup, is idempotent, and self-heals a missed boundary (quickstart Scenarios 3–5). US1 + US2 both work independently.

---

## Phase 5: User Story 3 - Stale lineups are flagged after rotation (Priority: P2)

**Goal**: When a pool is produced and a player's saved song is no longer offered, that lineup is flagged `is_valid = FALSE`; in-pool lineups are untouched; re-validation on save is unchanged.

**Independent Test**: Save a lineup with song X, run a rotation whose new pool excludes X, confirm that lineup is now invalid while an in-pool lineup stays valid; then save an in-pool lineup and confirm the flag clears. (quickstart Scenario 6.)

### Implementation for User Story 3

- [X] T013 [US3] Add `invalidateStaleLineups(weekStart, genderCategory)` — implement in `backend/services/weeklyPoolService.js` backed by a `backend/db.js` helper that runs `UPDATE lineups SET is_valid = FALSE WHERE gender_category = $1 AND song_id NOT IN (<pool song ids from getWeekPoolSongIds>)`; **skip the update entirely when the pool is empty** so existing valid lineups are not flagged against an empty set; return the number of rows invalidated (research Decision 6; contracts/scheduler.md `invalidateStaleLineups` contract; FR-011, FR-012, SC-006).
- [X] T014 [US3] Wire `invalidateStaleLineups(getMonday(), gender)` into `rotateAllGenders()` in `backend/scheduler.js` (after `ensureWeeklyPool`, logging rows invalidated) and into `backend/establish-weekly-pool.js` (after `ensureWeeklyPool`, so an operator re-establishing over an existing week keeps lineup flags consistent) (contracts/operator-cli.md notes; contracts/scheduler.md entry point; FR-011, FR-013).

**Checkpoint**: All three stories are independently functional; lineup flags are correct across the rotation boundary.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification and scope-guard confirmation across stories.

- [X] T015 [P] Verify the BG scope guard (FR-014, SC-008): with `node backend/establish-weekly-pool.js bg` run, confirm `GET /api/card-game/songs/weekly?genderCategory=gg` returns only GG songs and never a BG pool (quickstart Scenario 7) — confirm by construction in the gender-scoped read path in `backend/db.js` / route.
- [X] T016 Run the full `quickstart.md` validation (Scenarios 1–7) end-to-end against a seeded database and confirm each mapped success criterion (SC-001 through SC-008).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. **BLOCKS US1 and US2** (both call `ensureWeeklyPool`).
- **US1 (Phase 3)** and **US2 (Phase 4)**: Both depend only on Foundational. Can run in parallel once Phase 2 is done.
- **US3 (Phase 5)**: Depends on Foundational (T004 `getWeekPoolSongIds`). T014 also touches the US1 script and the US2 scheduler entry point, so it should land after T010 and T011 exist.
- **Polish (Phase 6)**: Depends on the desired stories being complete.

### User Story Dependencies

- **US1 (P1)**: Foundational only. Independently testable (quickstart 1–2).
- **US2 (P1)**: Foundational only. Independently testable (quickstart 3–5).
- **US3 (P2)**: Foundational only for its core logic (T013); its wiring task (T014) integrates with the US1 script and US2 scheduler but US3's flagging behavior is independently testable (quickstart 6).

### Within Each Story

- Models/queries (`db.js`) before services; services before scripts/scheduler wiring.
- T013 (logic) before T014 (wiring).

### Parallel Opportunities

- **Foundational**: T004 and T005 are db.js query additions in the same file — keep sequential to avoid edit conflicts. T002 (`seed-gacha-config.js`) and T006 (`weeklyPoolService.js` scaffold) touch different files and can run in parallel with the db.js work.
- **US1**: T009 (`confirm-idol-roles.js`) is independent of T010 and can run in parallel; T010 depends on `ensureWeeklyPool` (T007).
- **US1 vs US2**: Different files (scripts vs. `scheduler.js`) — can be developed in parallel by different people once Phase 2 is done.

---

## Parallel Example: User Story 1

```bash
# After Foundational (Phase 2) is complete:
# T009 is independent and can run alongside T010's prerequisites:
Task: "Create backend/confirm-idol-roles.js (reads getIdolsMissingRoles, prints report)"   # T009 [P]
# T010 depends on ensureWeeklyPool (T007):
Task: "Create backend/establish-weekly-pool.js (calls ensureWeeklyPool, prints summary)"    # T010
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup (T001).
2. Phase 2: Foundational (T002–T007) — CRITICAL, blocks both P1 stories.
3. Phase 3: User Story 1 (T008–T010).
4. **STOP and VALIDATE**: quickstart Scenarios 1 & 2 — a new player can build and save a valid lineup. This is the unblock.

### Incremental Delivery

1. Setup + Foundational → pool writer ready.
2. US1 → operator can establish a pool → **MVP** (game playable).
3. US2 → rotation runs automatically → weekly loop closes.
4. US3 → stale lineups flagged across the boundary → player experience protected.
5. Polish → BG scope guard + full quickstart sweep.

### Parallel Team Strategy

After Phase 2: Developer A takes US1 (operator scripts), Developer B takes US2 (scheduler). US3 follows once both the US1 script and US2 entry point exist (T014 wires into both).

---

## Notes

- [P] = different files, no dependencies. Multiple tasks editing `backend/db.js` (T003, T004, T005, T008, T013-helper) are intentionally **not** marked [P] to avoid same-file conflicts.
- No schema changes — every table already exists from feature 001's `migrate-card-game.js`.
- Reuse `getMonday()` and the gender-scoped read path already in `backend/db.js`; do not add new week-math.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
