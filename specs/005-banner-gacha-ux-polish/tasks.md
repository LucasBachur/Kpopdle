---
description: "Task list for Banner & Gacha UX Polish"
---

# Tasks: Banner & Gacha UX Polish

**Input**: Design documents from `/specs/005-banner-gacha-ux-polish/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/api.md ✓, quickstart.md ✓

**Tests**: Not requested — manual end-to-end validation per quickstart.md only.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no in-flight dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths included in every description

---

## Phase 1: Setup

**Purpose**: Apply the only schema change this feature requires before any story work begins.

- [X] T001 Append `ALTER TABLE banners ADD COLUMN IF NOT EXISTS subtitle TEXT NULL;` to the migration block at the end of `backend/migrate-card-game.js`
- [X] T002 Run `node backend/migrate-card-game.js` to apply the subtitle column to the local database

**Checkpoint**: `\d banners` in psql shows `subtitle | text | YES` — migration complete.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Expose `subtitle` on the banners API response so all downstream story work can rely on it.

**⚠️ CRITICAL**: Phase 3 (US2 frontend) cannot be validated without this.

- [X] T003 In `backend/db.js`, add `b.subtitle` to the SELECT list of `getActiveBanners()` (or equivalent banners query) so the field is returned in the `GET /card-game/banners` response per `contracts/api.md`

**Checkpoint**: `GET /card-game/banners` response includes `"subtitle": null` (or operator-set value) on each banner object.

---

## Phase 3: User Story 1 — Banner Free Pull Flow (Priority: P1) 🎯 MVP

**Goal**: Free pull grants are exclusively shown in the UI while remaining, and the balance read is protected by a row-level lock so concurrent claims cannot double-spend.

**Independent Test**: Grant 15 free pulls via SQL, open the banner as that player, verify only "Claim 10 Free Pulls" is shown, claim, verify "Claim 5 Free Pulls" appears (no paid buttons), claim again, verify paid pull buttons appear and free-pull button is gone. Fire two simultaneous pull requests with `free_pulls_remaining = 10`; confirm result is 0 (not negative).

### Implementation for User Story 1

- [X] T004 [P] [US1] In `backend/services/gachaService.js` inside `pull()`, remove the pre-transaction `getBannerFreePulls()` call and replace it with `SELECT free_pulls_remaining FROM banner_free_pulls WHERE user_id=$1 AND banner_id=$2 FOR UPDATE` executed via the already-open transaction client (after `BEGIN`, before any card resolution)
- [X] T005 [US1] In `frontend/src/card-game/components/BannerCard.jsx`, implement conditional pull-button render: when `banner.freePullsRemaining > 0`, show only a "Claim X Free Pulls" button where X = `Math.min(banner.freePullsRemaining, 10)` and hide paid pull buttons; when `freePullsRemaining` is 0 or absent, show only the standard paid pull buttons ("Pull ×1 (1 💎)" and "Pull ×10 (9 💎)")

**Checkpoint**: User Story 1 fully functional and testable per quickstart.md Scenario A.

---

## Phase 4: User Story 2 — Banner Discovery (Priority: P2)

**Goal**: Each banner on the Banners page shows an operator-set subtitle and, for time-limited banners, a live countdown updating every 60 seconds. Permanent banners show neither.

**Independent Test**: Set `subtitle = 'Summer Comeback Event'` via SQL on a time-limited banner, reload Banners page, verify subtitle appears below the banner title and a countdown label is visible. Wait 60 seconds without reloading, verify the countdown decrements. For the daily banner (null `endsAt`), verify no countdown or expiry indicator is shown.

### Implementation for User Story 2

- [X] T006 [US2] In `frontend/src/card-game/components/BannerCard.jsx`, render `banner.subtitle` as a subtitle element below the banner title when `banner.subtitle` is non-null and non-empty; render nothing when null
- [X] T007 [US2] In `frontend/src/card-game/components/BannerCard.jsx`, replace the static `endsInLabel()` helper (or equivalent) with a `useEffect` + `setInterval(60000)` pattern: on mount and each tick, recompute the countdown string from `banner.endsAt` (format: "Ends in Xd Xh Xm"); clear the interval on unmount; skip countdown entirely when `banner.endsAt` is null
- [X] T008 [P] [US2] In `frontend/src/card-game/components/BannerCard.module.css`, add CSS classes for the subtitle text element and the live countdown label (font size, color, spacing — visually distinct from the banner title)

**Checkpoint**: User Story 2 fully functional and testable per quickstart.md Scenario B.

---

## Phase 5: User Story 3 — Soloist Banner Rate-Up Skip (Priority: P2) — Verify Only

**Goal**: Confirm the existing implementation already satisfies FR-009/FR-010/FR-011. No code changes expected; this phase is verification only.

**Independent Test**: Open a banner with exactly one idol across all rarity tiers — confirm no Rate Up `<select>` is rendered and a pull completes successfully. Open a multi-idol banner — confirm Rate Up selector is present (no regression).

### Verification for User Story 3

- [X] T009 [US3] Search `frontend/src/card-game/components/BannerCard.jsx` for the soloist detection logic: confirm (a) `isSoloist` (or equivalent) is derived from `idolOptions.length === 1`, (b) `selectedIdolId` is pre-set to the single idol's ID when `isSoloist` is true, and (c) the Rate Up `<select>` is conditionally hidden when `isSoloist`; also check `backend/services/gachaService.js` pull() for a fallback when the soloist idol has no cards in the banner pool — if absent, add a guard that falls back to non-rate-up weight distribution and logs a warning (`console.warn` or equivalent); then validate against quickstart.md Scenario C using a single-idol banner (create a test banner if none exists), confirming no regression on multi-idol banners

**Checkpoint**: User Story 3 verified — soloist banners skip Rate Up selection; no regression.

---

## Phase 6: User Story 4 — Show Result Auto-Entry Confirmation (Priority: P2)

**Goal**: The show result page shows a status card when the viewing player has a currently valid lineup for the same gender category.

**Independent Test**: Ensure `lineups.is_valid = TRUE` for the player's GG lineup, navigate to any show result page, verify "Your lineup is registered for today's show" status card appears. Set `is_valid = FALSE`, reload, verify card is absent.

### Implementation for User Story 4

- [X] T010 [P] [US4] In `backend/db.js`, add `getLineupForAutoEntry(userId, genderCategory)` that executes `SELECT id FROM lineups WHERE user_id = $1 AND gender_category = $2 AND is_valid = TRUE LIMIT 1` and returns the row or null
- [X] T011 [P] [US4] In `backend/routes/cardGame.js`, extend the `GET /leaderboard/:showId` handler to call `getLineupForAutoEntry(req.user.userId, show.genderCategory)` (using the current day's context per FR-014) and include `autoEntryStatus: { isRegistered: boolean }` in the JSON response per `contracts/api.md`
- [X] T012 [P] [US4] In `frontend/src/card-game/pages/ShowResultPage.jsx`, read `autoEntryStatus.isRegistered` from the leaderboard API response and render a status card reading "Your lineup is registered for today's show" (or equivalent) when `true`; render nothing when `false` or when the field is absent

**Checkpoint**: User Story 4 fully functional and testable per quickstart.md Scenario D.

---

## Phase 7: User Story 5 — Daily Banner Card Pool Configuration (Priority: P3)

**Goal**: `claimDailyPull()` draws from the daily banner's explicitly configured `banner_cards` pool instead of the old global/event SR fallback chain. An empty pool surfaces an operator-actionable error without consuming the daily pull entitlement.

**Independent Test**: Find the GG daily banner ID, insert 2–3 cards into `banner_cards` for it, claim a daily pull as a player, verify the pulled card's `card_def_id` is in the inserted set. Empty the pool, reset cooldown, attempt a daily pull, verify a graceful error is returned and no card is added to the player's collection.

### Implementation for User Story 5

- [X] T013 [P] [US5] In `backend/db.js`, add `getDailyBannerCards(bannerId)` that executes `SELECT card_def_id FROM banner_cards WHERE banner_id = $1` and returns the array of card definition IDs (empty array if none)
- [X] T014 [US5] In `backend/services/gachaService.js:claimDailyPull()`, replace the global/event SR pool fallback chain (lines ~70–78) with a call to `getDailyBannerCards(dailyBanner.id)`; sample the pulled card from that pool for both Rare and SR draws; if the pool is empty, throw an operator-actionable error (`"Daily banner card pool is not configured"`) without decrementing the daily pull entitlement and without adding any card to the player's collection

**Checkpoint**: User Story 5 fully functional and testable per quickstart.md Scenario E.

---

## Phase 8: Polish & Validation

**Purpose**: End-to-end manual validation of all five user stories per quickstart.md.

- [X] T015 [P] Run quickstart.md Scenario A end-to-end: grant 15 free pulls via SQL, verify "Claim 10 Free Pulls" UI exclusivity, exhaust pulls, verify paid buttons appear, and fire concurrent pull requests to confirm `free_pulls_remaining` does not go negative
- [X] T016 [P] Run quickstart.md Scenario B end-to-end: set subtitle via SQL, reload Banners page, verify subtitle display and live countdown behavior, verify permanent banner shows neither, verify null subtitle shows nothing
- [X] T017 [P] Run quickstart.md Scenario C end-to-end: open single-idol banner and confirm no Rate Up selector, perform a pull, confirm success, open multi-idol banner and confirm selector is present (no regression)
- [X] T018 [P] Run quickstart.md Scenario D end-to-end: set `is_valid = TRUE` and verify status card on show result page, set `is_valid = FALSE` and verify card absent, delete lineup row and verify card absent
- [X] T019 [P] Run quickstart.md Scenario E end-to-end: populate daily banner pool, claim daily pull, verify card from pool, update pool without restart and verify, empty pool and verify graceful error; run cross-contamination check (pull on event banner returns event banner cards only)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (migration must be applied before testing the API change)
- **US1 (Phase 3)**: Depends on Phase 1 only — independent of Foundational (no subtitle dependency)
- **US2 (Phase 4)**: Depends on Phases 1 + 2 (subtitle must be in DB and in API response)
- **US3 (Phase 5)**: No implementation dependencies — can begin any time; verify only
- **US4 (Phase 6)**: Depends on Phase 1 only — no subtitle dependency
- **US5 (Phase 7)**: Depends on Phase 1 only — no subtitle dependency
- **Polish (Phase 8)**: Depends on all story phases completing

### User Story Dependencies

- **US1 (P1)**: Independent after Setup — no dependencies on other stories
- **US2 (P2)**: Requires Foundational (T003) for API subtitle field
- **US3 (P2)**: Verify-only — no implementation dependencies
- **US4 (P2)**: Independent after Setup — no cross-story dependencies
- **US5 (P3)**: Independent after Setup — no cross-story dependencies

### Within Each Story

- Backend DB helpers before route/service changes that call them
- Route/service changes before frontend rendering changes
- Implementation before validation

### Parallel Opportunities

- T004 (US1 backend) and T010 (US4 backend T010) and T013 (US5 backend) can run in parallel — all touch `db.js` but different functions
- T005 (US1 frontend BannerCard) and T012 (US4 frontend ShowResultPage) are different files — parallel
- T008 (US2 CSS) can run in parallel with any non-BannerCard.jsx task
- All Phase 8 validation tasks are independent — run in parallel

---

## Parallel Example: After Phase 2

```
# These can run simultaneously once Setup + Foundational complete:
T004 [US1] gachaService.js pull() FOR UPDATE lock
T006 [US2] BannerCard.jsx subtitle render
T009 [US3] BannerCard.jsx soloist verify
T010 [US4] db.js getLineupForAutoEntry
T013 [US5] db.js getDailyBannerCards
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 3: User Story 1 (T004–T005) — no Foundational dependency
3. **STOP and VALIDATE**: Run quickstart.md Scenario A
4. Deploy/demo if ready

### Incremental Delivery

1. Setup (T001–T002) → Foundation (T003) → ready for all stories
2. US1 (T004–T005) → validate Scenario A → ship atomic free pull lock + exclusive UI
3. US2 (T006–T008) → validate Scenario B → ship subtitle + countdown
4. US3 (T009) → validate Scenario C → verify soloist skip
5. US4 (T010–T012) → validate Scenario D → ship auto-entry status card
6. US5 (T013–T014) → validate Scenario E → ship daily banner pool

---

## Notes

- **No new source files**: All changes are in existing files per plan.md
- **ART timezone**: Any countdown computation involving today's date must account for `America/Argentina/Buenos_Aires` (UTC-3, no DST) for daily-reset-adjacent logic
- **gg_only_mode**: BG paths remain inactive; all tasks target GG scope unless noted
- **Operator flows**: Free pull grants, subtitle updates, and daily pool configuration are all direct SQL — no admin UI needed
- [P] tasks = different files or non-conflicting functions, no in-flight dependencies
- [Story] label maps each task to its user story for traceability
