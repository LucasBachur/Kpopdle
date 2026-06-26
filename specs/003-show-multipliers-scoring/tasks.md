---

description: "Task list for Show Multipliers & Scoring Completeness (feature 003)"
---

# Tasks: Show Multipliers & Scoring Completeness

**Input**: Design documents from `specs/003-show-multipliers-scoring/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/operator-cli.md ✓, contracts/scheduler.md ✓

**Tests**: No automated test framework. Validation via `quickstart.md` manual scenarios (Polish phase).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths are included in every task description

---

## Phase 1: Setup (Feature Schema)

**Purpose**: Additive migration that creates the `show_schedule_multipliers` table — the single prerequisite that blocks US1 seeding and scheduler integration.

- [X] T001 Create `backend/migrate-show-multipliers.js` — own `pg.Pool`, `BEGIN`/`COMMIT`, `CREATE TABLE IF NOT EXISTS show_schedule_multipliers` with columns `id SERIAL PK`, `schedule_id INTEGER FK→show_schedules`, `label TEXT`, `multiplier_value NUMERIC CHECK(>0)`, `applies_to_type TEXT CHECK IN('role','company','same_group')`, `applies_to_value TEXT`, unique constraint `(schedule_id, applies_to_type, COALESCE(applies_to_value,''))`; also add `CREATE UNIQUE INDEX IF NOT EXISTS show_multipliers_uniq ON show_multipliers(show_id, applies_to_type, COALESCE(applies_to_value,''))` — the existing `show_multipliers` table has no unique constraint, so this index is required for `ON CONFLICT` to work in `copyScheduleMultipliers`; print `Migration complete — show_schedule_multipliers ready.`; exit `1` on failure

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB helper function used by the scheduler — must exist before T004 can be written.

⚠️ **CRITICAL**: T004 (US1 scheduler hook) depends on T002. Complete this phase before starting T004.

- [X] T002 In `backend/db.js`: (a) add `(xmax = 0) AS "created"` to the RETURNING clause of `getOrCreateTodayShow` so callers can detect a fresh INSERT vs. a conflict-path UPDATE — the returned object gains a `created: boolean` field; (b) add `copyScheduleMultipliers(showId, scheduleId)` — `INSERT INTO show_multipliers (show_id, label, multiplier_value, applies_to_type, applies_to_value) SELECT $1, label, multiplier_value, applies_to_type, applies_to_value FROM show_schedule_multipliers WHERE schedule_id = $2 ON CONFLICT (show_id, applies_to_type, COALESCE(applies_to_value,'')) DO NOTHING`; return inserted row count; log `[scheduler] Copied N multiplier templates to show ${showId} from schedule ${scheduleId}`; silently no-op (return 0) when `scheduleId` is null

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 — Operator Seeds Multiplier Templates (Priority: P1) 🎯 MVP

**Goal**: Each of the five GG show schedules has a multiplier template; every new show inherits its schedule's templates at creation time. No show resolves with a flat 1× score when a template exists.

**Independent Test**: Run `node backend/migrate-show-multipliers.js` then `node backend/seed-multiplier-templates.js`. Query `show_schedule_multipliers` — 5 rows expected. Re-run seed and confirm row count unchanged. Trigger show creation and query `show_multipliers WHERE show_id = <new_show>` — at least 1 row expected.

- [X] T003 [P] [US1] Create `backend/seed-multiplier-templates.js` — define a `TEMPLATES` array with 5 entries mapping to GG show schedules: `(Show Champion, role, vocalist, +Vocalist, 1.15)`, `(M Countdown, role, rapper, +Rapper, 1.15)`, `(Music Bank, role, dancer, +Dancer, 1.15)`, `(Music Core, company, SM Entertainment, +SM Ent, 1.20)`, `(Inkigayo, same_group, any, +Group Synergy, 1.25)`; resolve each schedule name to its `id` via `SELECT id FROM show_schedules WHERE show_name = $1 AND gender_category = 'gg'`; insert using `INSERT INTO show_schedule_multipliers ... ON CONFLICT (schedule_id, applies_to_type, COALESCE(applies_to_value,'')) DO NOTHING`; print `  + ShowName: Label` or `  = already present` per row; print summary `Done — N inserted, M already present.`; exit `1` on unexpected failure
- [X] T004 [US1] Modify `createTodayShows()` in `backend/scheduler.js` — after `getOrCreateTodayShow(today, gender, scheduleId, showName, deadline)` returns, check `if (show.created)` to confirm the show was freshly inserted (not an existing show from a previous scheduler run); if true, call `copyScheduleMultipliers(show.id, schedule.id)` from `backend/db.js`; import the function at the top of the file; log the returned row count

**Checkpoint**: US1 fully functional. Seed is idempotent; every new show inherits multiplier templates from its schedule.

---

## Phase 4: User Story 2 — Shows Resolve With Real Multipliers (Priority: P1)

**Goal**: The scoring engine applies role, company, and `same_group` multipliers correctly — including both the homogeneity variant (`applies_to_value = 'any'`) and the specific-group variant (e.g., `'TWICE'`).

**Independent Test**: With US1 complete and today's show seeded, create two lineups with identical total `current_stat` but one matching the day's bonus category. Resolve the show. The matching lineup must score ≥10% higher (e.g., at 1.15×).

- [X] T005 [US2] Fix `same_group` branch in `isMultiplierApplicable()` in `backend/services/showService.js` — replace the current `return groups.size === 1` with: if `!val || val === 'any'` → homogeneity check: `const groups = new Set(lineupSlots.map(s => s.group?.toLowerCase())); return groups.size === 1`; else → specific-group check: `return lineupSlots.some(s => s.group?.toLowerCase() === val)` where `val = multiplier.appliesToValue?.toLowerCase()`

**Checkpoint**: US2 functional. Role, company, and both same_group sub-types score correctly at resolution.

---

## Phase 5: User Story 3 — Players See Multiplier Labels on Lineup Page (Priority: P2)

**Goal**: The lineup page displays a "Today's Bonuses" chip row with category labels (no numeric values). The section is absent when the show has no multipliers.

**Independent Test**: Navigate to `/card-game/lineup` with today's GG show having seeded multipliers. Confirm label chips appear. Inspect DOM and network response — confirm `multiplier_value` is not present anywhere. After show resolves, confirm labels switch to next pending show's labels or disappear.

- [X] T006 [US3] Add `getShowMultiplierLabels(showId)` to `backend/db.js` — `SELECT label FROM show_multipliers WHERE show_id = $1 ORDER BY id`; return array of label strings; return `[]` when show has no multipliers
- [X] T007 [US3] Modify `GET /api/card-game/shows/today` in `backend/routes/cardGame.js` — query the earliest pending GG show (`SELECT id, show_name, deadline, resolution_status FROM shows WHERE gender_category = 'gg' AND resolution_status = 'pending' ORDER BY deadline ASC LIMIT 1`); call `getShowMultiplierLabels(showId)` from `backend/db.js`; add `multiplierLabels: string[]` to the response object; do NOT include `multiplier_value` anywhere in the response; return `multiplierLabels: []` when no pending show exists
- [X] T008 [P] [US3] Modify `frontend/src/card-game/pages/LineupPage.jsx` — read `multiplierLabels` from the today's show API response; if `multiplierLabels.length > 0`, render a "Today's Bonuses" section above `LineupBuilder` with one chip per label (e.g., `+Rapper`, `+SM Ent`); render nothing (no empty section, no placeholder) when `multiplierLabels` is empty or absent

**Checkpoint**: Players see bonus category labels. Numeric multiplier values are not exposed in UI or API response.

---

## Phase 6: User Story 4 — Tied Scores Share a Rank (Priority: P2)

**Goal**: Standard competition ranking (1224 style): players with identical final scores share the same rank; the next rank after a tied group skips by the group's size; reward tier is determined by the shared rank's percentile, not array index.

**Independent Test**: Insert two show entries with identical `final_score` into a show. Trigger resolution. Both entries must have `rank = 1` and the same `reward_rarity`. A third entry with a lower score must have `rank = 3`.

- [X] T009 [US4] Fix `assignRanksAndRewards()` in `backend/services/showService.js` — before the loop, declare `let currentRank = 1`; inside the loop, before using the rank, add `if (i > 0 && entries[i].finalScore < entries[i - 1].finalScore) { currentRank = i + 1; }`; replace every use of `i + 1` as the rank value with `currentRank`; use `currentRank` (not `i + 1`) when computing `percentile = currentRank / total`

**Checkpoint**: Tied players share rank and reward tier. Rank after tie group skips correctly (1, 1, 3 pattern).

---

## Phase 7: User Story 5 — Chemistry Bonus Rewards Group Cohesion (Priority: P2)

**Goal**: Show resolution applies a logarithmic chemistry bonus based on group representation in the lineup (backend). The lineup builder shows a live chemistry percentage preview per group (frontend). Zero-cohesion lineups are unaffected (no penalty).

**Independent Test (backend)**: Two lineups, same total stat — one with 2+ cards from the same group, one all different groups. Resolve show. Group-cohesion lineup scores higher. Full-group lineup scores at `1 + chemistry_max_bonus` relative to no-cohesion baseline.

**Independent Test (frontend)**: Add two cards from same group → chemistry section appears with "GroupName: 50% Chemistry". Add a third groupmate → updates to 75%. Remove one → reverts. Remove both → section disappears entirely.

- [X] T010 [P] [US5] Add `chemistry_max_bonus` key to `backend/seed-gacha-config.js` — insert `['chemistry_max_bonus', '0.15']` using the existing `ON CONFLICT (key) DO NOTHING` pattern alongside the other config keys
- [X] T011 [P] [US5] Add `groupSize` correlated subquery to `getPlayerCards(userId)` in `backend/db.js` — append `(SELECT COUNT(*)::int FROM idols i2 WHERE i2."group" = i."group") AS "groupSize"` to the existing SELECT; verify the column is included in the returned row objects
- [X] T012 [US5] Add group size map query to show resolution in `backend/services/showService.js` — at the start of `resolveShow()` (before the per-lineup loop), run `SELECT "group", COUNT(*)::int AS cnt FROM idols GROUP BY "group"`; build `const groupSizeMap = new Map(rows.map(r => [r.group, r.cnt]))`; pass `groupSizeMap` as the 4th argument to every `calculateScore()` call in the resolution loop
- [X] T013 [US5] Implement chemistry bonus in `calculateScore()` in `backend/services/showService.js` — add `groupSizeMap` as 4th parameter; after show multipliers are applied (before random factor), iterate `lineupSlots` to count per-group card totals; for each group `G` with count `n`: `const G_size = groupSizeMap.get(G) ?? n; const ratio = n <= 1 ? 0 : n >= G_size ? 1.0 : 0.5 + 0.5 * Math.log(n - 1) / Math.log(G_size - 1)`; take `chemistry_ratio_final = Math.max(...all per-group ratios, 0)`; compute `chemistry_multiplier = 1 + chemistry_ratio_final * (config.chemistry_max_bonus ?? 0.15)`; apply to final score: `finalScore = Math.round(score_after_show_multipliers * sizeBonus * randomFactor * chemistry_multiplier)` — **note**: `sizeBonus` and `randomFactor` are pre-existing local variables in `calculateScore()`; do not rename or remove them — this task only appends `* chemistry_multiplier` to the existing final score expression
- [X] T014 [P] [US5] Update `frontend/src/card-game/services/cardGameApi.js` — ensure `groupSize` field from the player cards API response is not stripped during data mapping or transformation; if cards are remapped/shaped before being passed to components, include `groupSize: card.groupSize` in the mapped object
- [X] T015 [US5] Implement live chemistry preview in `frontend/src/card-game/components/LineupBuilder.jsx` — on each lineup state change, group currently-filled slots by `card.group`; for each group with `n >= 2` cards, compute `chemistry_ratio` using the same formula (`n >= G_size ? 1.0 : 1 - Math.pow(0.5, n - 1)` where `G_size = card.groupSize` from any card in that group); render per-group display: `"GroupName: X% Chemistry"` (X = `Math.round(ratio * 100)`); render nothing (no section, no empty list) when no group has `n >= 2`

**Checkpoint**: Chemistry bonus applies at resolution and live preview is functional on the lineup page.

---

## Phase 8: Polish & Cross-Cutting Validation

**Purpose**: Manual end-to-end validation across all user stories per `quickstart.md` acceptance checkpoints.

- [X] T016 Run `quickstart.md` validation — execute all 8 scenarios in order: S1 (migration + seed idempotency → SC-001, SC-006), S2 (show creation with multipliers → SC-002), S3 (scoring comparison → SC-003), S4 (chemistry backend → SC-007, SC-008), S5 (tie ranking → SC-005), S6 (label display → SC-004), S7 (live chemistry preview → SC-009), S8 (same_group specific-group bonus)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T002 is meaningful only after migration creates the table) — blocks T004
- **Phase 3 (US1)**: T003 and T002 can run in parallel; T004 depends on T002
- **Phase 4 (US2)**: T005 is independent of US1 code; can start after Phase 1; fully testable only after US1 data is present
- **Phase 5 (US3)**: T006 → T007 (sequential); T008 can be developed in parallel against the API contract defined in `contracts/scheduler.md`
- **Phase 6 (US4)**: Fully independent — can run in parallel with Phases 3–5 after Phase 1
- **Phase 7 (US5)**: T010 [P], T011 [P] run in parallel; T012 → T013 (sequential, same file); T014 [P] runs in parallel; T015 depends on T014
- **Phase 8 (Polish)**: All phases complete

### User Story Dependencies

- **US1 (P1)**: Requires Phases 1 + 2
- **US2 (P1)**: Code change (T005) independent; full validation requires US1 data
- **US3 (P2)**: Code changes independent; full validation requires US1 data
- **US4 (P2)**: Fully independent of US1/US2/US3
- **US5 (P2)**: Fully independent of US1/US2/US3

### Parallel Opportunities

- T003 [P] (new file) and T002 [P] (existing db.js) can run together after Phase 1
- T005 (US2), T006 (US3), T009 (US4), T010 (US5), T011 (US5) are all parallelizable after Phase 1 completes
- T008 [P] (frontend) can be developed against the API contract while T006/T007 are implemented
- T014 [P] (cardGameApi.js) can run in parallel with T010/T011/T012

---

## Parallel Example: User Story 5 (Chemistry)

```bash
# Launch in parallel (different files, no inter-dependencies):
Task: T010 — Add chemistry_max_bonus to backend/seed-gacha-config.js
Task: T011 — Add groupSize to getPlayerCards() in backend/db.js
Task: T014 — Pass groupSize through frontend/src/card-game/services/cardGameApi.js

# Then sequential (same file, T013 depends on T012):
Task: T012 — Add groupSizeMap query in backend/services/showService.js
Task: T013 — Implement chemistry bonus in calculateScore() in backend/services/showService.js

# Then (depends on T014):
Task: T015 — Implement chemistry preview in frontend/src/card-game/components/LineupBuilder.jsx
```

---

## Implementation Strategy

### MVP First (P1 Stories — US1 + US2)

1. Complete Phase 1: Setup (T001 migration)
2. Complete Phase 2: Foundational (T002 db helper)
3. Complete Phase 3: US1 — seed + scheduler (T003, T004)
4. Complete Phase 4: US2 — same_group fix (T005)
5. **STOP and VALIDATE**: Run quickstart.md Scenarios 1–3
6. Multiplier-driven scoring is live

### Incremental Delivery

1. Setup + Foundational → Schema ready
2. US1 → Templates seeded, scheduler copies on creation → Validate (S1, S2)
3. US2 → Scoring applies multipliers correctly → Validate (S3, S8)
4. US3 → Labels on lineup page → Validate (S6)
5. US4 → Tie-handling fixed → Validate (S5)
6. US5 → Chemistry active + preview → Validate (S4, S7)

### Parallel Team Strategy

With multiple developers, after Phase 1 + 2 complete:
- Developer A: US1 (T003, T004)
- Developer B: US2 (T005) + US4 (T009) — different functions in same file, safe to sequence
- Developer C: US3 backend (T006, T007) + frontend (T008)
- Developer D: US5 backend (T010, T011, T012, T013)
- Developer E: US5 frontend (T014, T015)

---

## Notes

- `[P]` tasks = different files, no incomplete task dependencies — safe to run in parallel
- `[Story]` label maps each task to a specific user story for traceability
- No automated tests — validation via `quickstart.md` manual scenarios only
- No new npm packages required — existing Express/pg/React stack
- All schema changes are additive (`CREATE TABLE IF NOT EXISTS` only; no drops, no renames)
- Migration must run once before any seed scripts
- All seed scripts are idempotent — safe to re-run at any time
- `same_group` sentinel value `'any'` triggers homogeneity check; any other string triggers specific-group match
- Chemistry `chemistry_max_bonus` has fallback `?? 0.15` in code — T010 adds it to config for operator tunability
