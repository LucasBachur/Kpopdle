# Quickstart Validation Guide: Kpopdle Card Game

**Phase**: 1 — Design
**Date**: 2026-06-14
**Feature**: [spec.md](spec.md) | [data-model.md](data-model.md) | [contracts/api.md](contracts/api.md)

This guide describes how to validate that the card game feature works end-to-end after implementation. Each scenario maps to the user stories in the spec. Use these as acceptance checkpoints — not automated tests.

---

## Prerequisites

- Backend running locally (`npm start` in `backend/`)
- Frontend running locally (`npm run dev` in `frontend/`)
- PostgreSQL database accessible with the card game schema applied
- At least 3 idol records seeded with `roles` populated (e.g., one rapper, one maknae)
- At least 2 song records with `member_count` set (e.g., one 9-member, one 1-member)
- At least one SR and one UR `card_definition` seeded and `is_active = true`
- At least one active `banner` (SR, GG, TWICE group)
- At least one `show_schedule` seeded for today's day of week (GG)
- Today's `show` record created with `resolution_status = 'pending'` and a future `deadline`
- At least one `show_multiplier` attached to today's show
- `gacha_config` table seeded with all required keys (see research.md)

---

## Scenario 1: New Player Onboarding

**Steps**:
1. Register a new account via `POST /api/auth/register`
2. Call `GET /api/card-game/me` — verify `tickets` contains 3 entries (one per rarity), all `redeemed: false`
3. Call `GET /api/card-game/collection` — verify `cards` contains one Rare card per idol in the `idols` table
4. Call `GET /api/card-game/tickets/ultra_rare/eligible-cards` — verify list contains active UR card definitions
5. Redeem the UR ticket via `POST /api/card-game/tickets/:ticketId/redeem` with a valid `cardDefId`
6. Call `GET /api/card-game/collection` again — verify the redeemed card appears with the correct UR stat

**Expected**: All steps complete without error. Collection grows by 1 UR card after redemption.

---

## Scenario 2: Build and Submit a Lineup

**Steps**:
1. Log in as the registered player
2. Call `GET /api/card-game/songs/weekly?genderCategory=gg` — note a song with `memberCount > 1`
3. Call `GET /api/card-game/collection` — select `playerCardId` values to fill each slot
4. Submit lineup via `PUT /api/card-game/lineup/gg` with the song and all required slots
5. Verify response: `appliesTo: "today"`, no `notice`
6. Call `GET /api/card-game/lineup/gg` — verify saved lineup matches submission exactly

**Expected**: Lineup saved with `isValid: true` and correct slot count matching the song's `member_count`.

---

## Scenario 3: After-Deadline Submission Notice

**Steps**:
1. Temporarily set today's show `deadline` to a past timestamp in the DB
2. Submit a new lineup via `PUT /api/card-game/lineup/gg`
3. Verify response: `appliesTo: "next_show"`, `notice` message present ("tomorrow's show")
4. Restore the deadline

**Expected**: System correctly identifies the missed deadline and notifies the player without blocking the save.

---

## Scenario 4: Show Resolution and Leaderboard

**Steps**:
1. Ensure at least 3 players have active lineups for today's GG show
2. Trigger show resolution (either wait for the scheduler, or call a protected internal endpoint if provided for testing)
3. Call `GET /api/card-game/shows/today` — verify `resolutionStatus: "resolved"`
4. Call `GET /api/card-game/leaderboard/:showId` — verify all participating players appear with correct scores and ranks
5. Call `GET /api/card-game/me` for each player — verify currency increased by the appropriate reward rarity (UR pull for top 10%, SR for top 50%, Rare for rest)

**Expected**: All 3 players appear on leaderboard. Ranks are ordered by `finalScore` descending. Rewards match the configured percentile thresholds.

---

## Scenario 5: Daily Free Pack

**Steps**:
1. Log in as a player who has not claimed today's free pack
2. Call `GET /api/card-game/me` — verify `freePackAvailable.gg: true`
3. Claim the pack via `POST /api/card-game/free-pack/claim` with `genderCategory: "gg"`
4. Verify response contains Rare cards (count matches `gacha_config.free_pack_rare_count`)
5. Call `GET /api/card-game/me` again — verify `freePackAvailable.gg: false`
6. Attempt to claim again — expect a `400` or `409` error
7. After midnight (or by advancing the DB timestamp), verify `freePackAvailable.gg` resets to `true`

**Expected**: Pack claimable once per calendar day per gender category.

---

## Scenario 6: Banner Pull and Pity System

**Steps**:
1. Ensure an active SR banner exists for TWICE (GG), with at least 2 member card_defs
2. Call `GET /api/card-game/banners` — verify the TWICE SR banner appears with correct members
3. Pull once: `POST /api/card-game/banners/:bannerId/pull` with `count: 1`, `rateUpCardDefId: <Sana's cardDefId>`
4. Verify `pityCounters.super_rare` incremented (unless SR pulled)
5. Set `pity_counters.pull_count` to `sr_pity_threshold - 1` in the DB for this player
6. Pull once more — verify response contains an SR card (pity triggered)
7. Verify `pityCounters.super_rare` reset to 0

**Expected**: Pity triggers at the configured threshold. Rate Up idol appears at elevated frequency over many pulls.

---

## Scenario 7: Duplicate Upgrade and Overflow

**Steps**:
1. Find a player who owns a Rare card at stat 85 (the Rare ceiling)
2. Pull (or directly insert) a duplicate of that card definition
3. Verify the pull response: `wasOverflow: true`, `wasUpgrade: false`
4. Call `GET /api/card-game/collection` — verify `overflowDuplicates` contains one entry for that card def
5. Convert the overflow duplicate: `POST /api/card-game/overflow/:duplicateId/convert` with `convertTo: "currency"`
6. Verify `currencyAwarded: 1` in response and overflow entry removed
7. Repeat step 2–4, but call convert with `convertTo: "cosmetic"` instead
8. Verify cosmetic awarded and overflow entry removed

**Expected**: Overflow duplicates are held without auto-conversion. Player chooses the conversion target. Both currency and cosmetic paths work.

---

## Scenario 8: Config Hotswap

**Steps**:
1. Note the current value of `gacha_config` key `random_score_range`
2. Update it in the DB to `0.0` (no randomness)
3. Resolve a show (or trigger manually)
4. Inspect `show_entries.final_score` — verify all scores are exactly `base_score × multipliers × size_bonus` with no variance
5. Restore the original value

**Expected**: Config changes take effect at next resolution without any code changes or server restarts.

---

## Scenario 9: Leaderboard — Tie Handling

**Steps**:
1. Force two players to have identical `final_score` in `show_entries` for the same show
2. Call `GET /api/card-game/leaderboard/:showId`
3. Verify both players share the same `rank` value
4. Verify reward assignment treats both as being at that shared rank (both receive the same reward tier)

**Expected**: Ties result in shared ranks; no player is artificially demoted.

---

## Scenario 10: GG/BG Separation

**Steps**:
1. Confirm no BG shows, banners, or leaderboards are accessible via the frontend UI
2. Confirm BG tables exist in the DB (e.g., `show_schedules` has rows with `gender_category = 'bg'`)
3. Call `GET /api/card-game/shows/today` — verify response contains only GG shows
4. Call `GET /api/card-game/banners` — verify response contains only GG banners

**Expected**: BG data exists in the database but is not surfaced in any UI or API response available to players.
