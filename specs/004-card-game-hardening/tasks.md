---
description: "Task list for Card Game Hardening & GG-Only Launch Mode"
---

# Tasks: Card Game Hardening & GG-Only Launch Mode

**Input**: Design documents from `/specs/004-card-game-hardening/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: No automated test framework exists in this project. Validation is a manual acceptance pass via `quickstart.md` (Scenarios A–E) plus the Feature 001 quickstart (Scenarios 1–10). No test tasks are generated; verification tasks live in User Story 5.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths are included in each description

## Path Conventions

- **Web app**: backend under `backend/`, frontend under `frontend/src/card-game/`. Matches Features 001–003.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the working environment; no new dependencies are introduced by this feature.

- [X] T001 Confirm branch `004-card-game-hardening` is checked out and the backend (`backend/`) + frontend (`frontend/`) run as in Feature 001; verify no new npm packages are needed (express 5, pg, node-cron, React already present per plan.md).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Verify the shared persistence layer the stories build on is reachable before any story work begins.

**⚠️ CRITICAL**: Complete before starting any user story.

- [X] T002 Verify Postgres is reachable via `DATABASE_URL` and the existing `gacha_config`, `users` (with `ur_tickets`), and `player_cards` tables are present, so additive changes in later phases can be applied without altering existing schema (see `specs/004-card-game-hardening/data-model.md`).

**Checkpoint**: Foundation verified — user stories can now begin.

---

## Phase 3: User Story 1 - Girl-Group-Only Launch Enforcement (Priority: P1) 🎯 MVP

**Goal**: A config-driven `gg_only_mode` flag, enforced by a `403` guard on every Boy-Group-scoped route, with the flag surfaced to the frontend so all Boy Group entry points are hidden while enabled.

**Independent Test**: Enable GG-only mode; attempt every BG-targeted request as a logged-in player and confirm each returns `403` with no BG data; confirm every equivalent GG request succeeds; confirm the UI shows zero BG entry points; disable the mode and confirm BG requests are permitted again.

### Implementation for User Story 1

- [X] T003 [P] [US1] Add `gg_only_mode` default seed (`'1'` = enabled) to `backend/seed-gacha-config.js` using idempotent `ON CONFLICT (key) DO NOTHING`, per `data-model.md` (reused `gacha_config` table).
- [X] T004 [P] [US1] Add `getGgOnlyMode()` helper to `backend/db.js` reading `gacha_config.gg_only_mode`; return `true` when the row is missing or `parseFloat(value) !== 0`, `false` only for explicit `'0'` (per `contracts/gg-only-guard.md`).
- [X] T005 [US1] Create `backend/middleware/ggOnlyGuard.js`: resolve gender from `req.params.genderCategory` → `req.body?.genderCategory` → `req.query?.genderCategory` (first defined wins, default `gg`); if resolved gender is `bg` and `getGgOnlyMode()` is enabled, respond `403 { error: 'Boy Group content is not available.' }` before the handler; otherwise `next()` (depends on T004).
- [X] T006 [US1] Apply `ggOnlyGuard` in `backend/routes/cardGame.js` to the BG-capable routes: `POST /daily-pull/claim`, `GET /songs/weekly`, `GET /lineup/:genderCategory`, `PUT /lineup/:genderCategory`, `GET /leaderboard/history` (per route table in `contracts/gg-only-guard.md`); leave `GET /banners` and `GET /shows/today` unguarded (hardcoded `gg`) (depends on T005).
- [X] T006a [US1] In `POST /banners/:bannerId/pull` in `backend/routes/cardGame.js`, after loading the banner, reject with `403 { error: 'Boy Group content is not available.' }` when the banner's `genderCategory === 'bg'` and `getGgOnlyMode()` is enabled, **before** any currency is spent (closes the BG-banner-by-id gap that `ggOnlyGuard` cannot catch, since gender comes from the banner record not the request; FR-002; per `contracts/gg-only-guard.md`). Confirm `getBannerWithMembers` returns `genderCategory`; add it to the select if missing (depends on T004).
- [X] T007 [US1] Surface a top-level boolean `ggOnlyMode` field (from `getGgOnlyMode()`) in the `GET /me` response in `backend/routes/cardGame.js` (depends on T004).
- [X] T008 [US1] In `frontend/src/card-game/`, read `me.ggOnlyMode` from the existing `/me` fetch and hide/disable every Boy Group entry point (tabs, buttons, nav items, gender selectors, BG labels) while `true`; audit `frontend/src/card-game/pages/*.jsx` and components for any latent BG selector and gate it on `!ggOnlyMode` (depends on T007).
- [X] T009 [US1] Run `node backend/seed-gacha-config.js` to seed `gg_only_mode = '1'`, then verify `GET /api/card-game/me` returns `"ggOnlyMode": true` (depends on T003, T007).

**Checkpoint**: GG-only mode enforces `403` on all BG routes (backend trust boundary) and the UI shows zero BG entry points. MVP is functional.

---

## Phase 4: User Story 2 - Trustworthy Write Validation (Priority: P2)

**Goal**: Every write route rejects malformed/out-of-range input with a clear `400` and no state change.

**Independent Test**: For each write action submit boundary/invalid values (pull count 0, 11, non-numeric; unrecognized gender; lineup with duplicate slot positions or wrong slot count; slot with non-integer `playerCardId`) and confirm each is rejected with a clear validation error and no state change.

### Implementation for User Story 2

- [X] T010 [US2] In `PUT /lineup/:genderCategory` in `backend/routes/cardGame.js`, add slot-shape validation: every slot must have an integer `playerCardId` and integer `slotPosition`, validated **before** the `ANY($2::int[])` ownership query, returning `400` instead of letting a null/non-integer reach the int-array cast (closes the 500→400 gap; FR-010, rule 4 in `contracts/write-validation.md`).
- [X] T011 [US2] Confirm existing validations in `backend/routes/cardGame.js` still hold and return clear `400`s with no state change: banner pull `count` integer 1–10 (no currency spent on failure), `genderCategory ∈ {gg, bg}` on every gender-bearing route incl. free-pack claim, duplicate `slotPosition` rejection, and filled-slot count `=== song.memberCount` (FR-005–FR-008; verify against `contracts/write-validation.md` boundary cases).

**Checkpoint**: All malformed writes rejected with actionable errors and zero state change (SC-003).

---

## Phase 5: User Story 3 - Lineup Card Ownership Enforcement (Priority: P2)

**Goal**: On lineup save, every referenced card must exist and belong to the requesting player; any miss rejects the whole submission and leaves the prior lineup unchanged.

**Independent Test**: Submit a lineup including another player's card id (refused `403`) or a non-existent card id (refused `400`), confirming the lineup is unchanged in both cases; submit the same lineup using only the player's own cards and confirm it saves.

### Implementation for User Story 3

- [X] T012 [US3] In `PUT /lineup/:genderCategory` in `backend/routes/cardGame.js`, split the current single ownership check (which returns `403` for both missing and unowned cards) into two: first verify every `playerCardId` exists in `player_cards` for **any** user — any id absent entirely → `400 One or more cards do not exist`; then verify every existing card belongs to the requesting user — a card owned by another user → `403 One or more cards do not belong to this player`. Writes occur only inside the final transaction so the prior lineup is unchanged on failure (FR-009; rules 6–7 in `contracts/write-validation.md`; depends on T010 — same route, slot-shape validation must run first).

**Checkpoint**: No lineup containing an unowned or non-existent card can be saved (SC-004).

---

## Phase 6: User Story 4 - Annual Ultra-Rare Ticket Grant (Priority: P3)

**Goal**: On each operator-configured grant date (default Dec 31), every registered player receives exactly one additional UR ticket, idempotent across restarts/repeat runs.

**Independent Test**: Configure a grant date equal to today, run the daily process, confirm every registered player's `ur_tickets` increased by exactly one and `ur_grant_log` has today's row; run again the same day and confirm no further increase; set the configured date to a non-today value (clearing today's log row) and confirm no grant.

### Implementation for User Story 4

- [X] T013 [P] [US4] Create `backend/migrate-ur-grant.js` (additive, idempotent `CREATE TABLE IF NOT EXISTS`): `ur_grant_dates(month SMALLINT NOT NULL CHECK 1–12, day SMALLINT NOT NULL CHECK 1–31, UNIQUE(month, day))` and `ur_grant_log(grant_date DATE PRIMARY KEY, granted_at TIMESTAMPTZ NOT NULL DEFAULT now())` (per `data-model.md`).
- [X] T014 [P] [US4] Create `backend/seed-ur-grant-dates.js` seeding the single default row `(12, 31)` with idempotent `ON CONFLICT DO NOTHING` (FR-013 default; `data-model.md`).
- [X] T015 [US4] Add grant queries to `backend/db.js`: read configured `(month, day)` rows from `ur_grant_dates`; attempt `INSERT INTO ur_grant_log (grant_date) VALUES ($todayStr) ON CONFLICT DO NOTHING` (returning rowCount); and `grantUrTicketToAll()` running `UPDATE users SET ur_tickets = ur_tickets + 1` — marker insert and update inside a single transaction (depends on T013).
- [X] T016 [US4] Add `processAnnualUrGrant()` to `backend/scheduler.js`: compute today's ART date `YYYY-MM-DD` and `(month, day)`; no-op if not in `ur_grant_dates`; else attempt the marker insert and run `grantUrTicketToAll()` only when the insert affected 1 row (at-most-once-per-date-per-year); wire it into the existing daily cron `0 3 * * *` alongside `createTodayShows()` and into the startup catch-up (FR-011, FR-012, FR-014; `contracts/annual-ur-grant.md`; depends on T015).
- [X] T017 [US4] Run `node backend/migrate-ur-grant.js` then `node backend/seed-ur-grant-dates.js`; verify both tables exist and contain the default `(12, 31)` row (depends on T013, T014).

**Checkpoint**: On a configured grant date, every registered account gains exactly one UR ticket with zero duplicate grants across repeated runs (SC-005).

---

## Phase 7: User Story 5 - End-to-End Launch Validation (Priority: P3)

**Goal**: Prove the hardening did not regress existing functionality and that GG/BG separation holds.

**Independent Test**: Execute this feature's quickstart Scenarios A–D and the Feature 001 quickstart Scenarios 1–10 end to end, recording pass/fail for each.

### Implementation for User Story 5

- [X] T018 [US5] Execute `specs/004-card-game-hardening/quickstart.md` Scenarios A (GG-only gating, incl. toggle + UI check), B (write validation boundaries), C (lineup ownership), and D (annual UR grant), recording results in the quickstart Result log (depends on US1–US4).
- [X] T019 [US5] Execute Feature 001 quickstart Scenarios 1–10 (`specs/001-idol-card-game/quickstart.md`) against the hardened build, with particular attention to Scenario 10 (GG/BG separation, now backed by `gg_only_mode`); record pass/fail for all ten (FR-015, SC-006; depends on T018).

**Checkpoint**: All quickstart scenarios pass; zero BG data surfaces through any player-facing request while GG-only mode is enabled.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final tidy-up across the feature.

- [X] T020 [P] Re-confirm all new/seed/migration scripts are idempotent (re-running `migrate-ur-grant.js`, `seed-ur-grant-dates.js`, `seed-gacha-config.js` causes no errors or duplicate rows) and all schema changes remain additive (no drops/renames).
- [X] T021 Verify error responses across guarded/validated routes distinguish gating (`403`) from bad input (`400`) and from ownership failure (`403`) with clear, actionable messages (FR-010).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–7)**: All depend on Foundational completion.
  - US1 (P1) is the MVP and is fully independent.
  - US2 (P2) and US3 (P2) both modify `PUT /lineup` in `backend/routes/cardGame.js`; US3 (T012) depends on US2 (T010) because slot-shape validation must run before the ownership query in the same handler.
  - US4 (P3) is fully independent of US1–US3.
  - US5 (P3) depends on US1–US4 being complete (it validates them).
- **Polish (Phase 8)**: Depends on all desired user stories being complete.

### Within Each User Story

- US1: T003 ∥ T004 → T005 → T006; T004 → T006a; T004 → T007 → T008; (T003 + T007) → T009.
- US2: T010 → T011 verification (same file, sequential).
- US3: T012 (after US2 T010).
- US4: T013 ∥ T014 → T015 → T016; (T013 + T014) → T017.
- US5: T018 → T019.

### Parallel Opportunities

- US1: T003 and T004 touch different files (`seed-gacha-config.js`, `db.js`) — run in parallel.
- US4: T013 and T014 touch different files (`migrate-ur-grant.js`, `seed-ur-grant-dates.js`) — run in parallel.
- US1 and US4 are independent and can be developed in parallel by different developers once Foundational is done.
- Polish: T020 is [P] (script re-runs) and independent of T021.

---

## Parallel Example: User Story 1

```bash
# Launch the two independent-file tasks together:
Task: "Add gg_only_mode default seed to backend/seed-gacha-config.js"
Task: "Add getGgOnlyMode() helper to backend/db.js"
```

## Parallel Example: User Story 4

```bash
# Launch the two new-file tasks together:
Task: "Create backend/migrate-ur-grant.js (ur_grant_dates, ur_grant_log)"
Task: "Create backend/seed-ur-grant-dates.js (seed default 12,31)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1 (GG-only enforcement — the single most important launch safety boundary).
4. **STOP and VALIDATE**: Run quickstart Scenario A independently.
5. Deploy/demo if ready.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 (P1) → validate Scenario A → deploy (MVP: launch is safely GG-only).
3. US2 + US3 (P2) → validate Scenarios B & C → deploy (write/ownership integrity).
4. US4 (P3) → validate Scenario D → deploy (annual grant).
5. US5 (P3) → full regression pass (Scenarios A–E + Feature 001 1–10).

### Notes

- [P] tasks = different files, no dependencies.
- Much of US2/US3 is already implemented on this branch; those tasks are confirm/close-the-gap rather than greenfield (see `research.md` Decision 3).
- All schema changes are additive; all seed/migration scripts must be idempotent.
- Commit after each task or logical group.
