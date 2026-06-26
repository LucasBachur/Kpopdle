# Quickstart: Card Game Hardening & GG-Only Launch Mode

Validation guide proving the hardening works end-to-end. References
[contracts/](contracts/) and [data-model.md](data-model.md) for rule details.

## Prerequisites

- Postgres reachable via `DATABASE_URL`; backend and frontend run as in Feature 001.
- Migration + seeds applied:
  ```bash
  node backend/migrate-ur-grant.js      # creates ur_grant_dates, ur_grant_log
  node backend/seed-ur-grant-dates.js   # seeds default (12, 31)
  node backend/seed-gacha-config.js     # seeds gg_only_mode = '1' (and existing keys)
  ```
- A logged-in player token (`Authorization: Bearer <token>`) for API checks.
- A second player's owned card id available (for the ownership-negative check).

## Scenario A — GG-only gating (US1)

1. Ensure enabled: `UPDATE gacha_config SET value='1' WHERE key='gg_only_mode';`
2. `GET /api/card-game/me` → response includes `"ggOnlyMode": true`.
3. BG requests must each return **403** (no BG data):
   - `GET /api/card-game/songs/weekly?genderCategory=bg`
   - `GET /api/card-game/lineup/bg`
   - `PUT /api/card-game/lineup/bg`
   - `POST /api/card-game/daily-pull/claim` with body `{"genderCategory":"bg"}`
   - `GET /api/card-game/leaderboard/history?genderCategory=bg`
4. Equivalent GG requests (`genderCategory=gg` / `/lineup/gg`) succeed.
5. UI check (SC-001a): with mode enabled, no BG tab/button/selector/label is visible or actionable.
6. Disable: `UPDATE gacha_config SET value='0' WHERE key='gg_only_mode';` → repeat step 3; BG requests now behave like GG (no restart needed).
7. Re-enable for launch defaults.

**Expected**: 100% of BG requests refused while enabled; GG unaffected; toggle is live.

## Scenario B — Write validation (US2)

- Banner pull `count` of `0`, `11`, `"x"`, missing → **400**, currency unchanged; `1` and `10` accepted.
- Any write with `genderCategory` outside {gg, bg} → **400**.
- `PUT /lineup/gg` with two slots sharing a `slotPosition` → **400**, lineup unchanged.
- `PUT /lineup/gg` with filled-slot count ≠ song member count → **400**.
- `PUT /lineup/gg` with a slot missing/with non-integer `playerCardId` → **400** (not 500).

**Expected**: every malformed write rejected with a clear error, no state change (SC-003).

## Scenario C — Lineup ownership (US3)

- `PUT /lineup/gg` including another player's card id → **403**; including a non-existent card id → **400**; existing lineup unchanged in both cases.
- `PUT /lineup/gg` using only the player's own cards (valid shape & counts) → saves.

**Expected**: no lineup with an unowned card can be saved (SC-004).

## Scenario D — Annual UR grant (US4)

1. `INSERT INTO ur_grant_dates (month, day) VALUES (<today_month>, <today_day>) ON CONFLICT DO NOTHING;`
2. Record current `ur_tickets` for a few users. Trigger the grant (restart backend, or invoke `processAnnualUrGrant()`).
3. Each user's `ur_tickets` increased by exactly **1**; `ur_grant_log` has a row for today.
4. Trigger again same day → no further increase (idempotent).
5. Remove today's row / set a non-today date, clear today's `ur_grant_log` row, re-run → no grant.

**Expected**: exactly one ticket per registered account per grant date, zero duplicates (SC-005).

## Scenario E — Feature 001 regression pass (US5)

Run **Feature 001 quickstart Scenarios 1–10** (`specs/001-idol-card-game/quickstart.md`) against the hardened build and record pass/fail for each. Pay special attention to Scenario 10 (GG/BG separation), now backed by `gg_only_mode`.

**Expected**: all 10 scenarios pass; Scenario 10 surfaces zero BG data through any player-facing request (SC-006).

## Result log

| Scenario | Pass/Fail | Notes |
|----------|-----------|-------|
| A — GG-only gating         | Pass | Fixed route order bug: `/leaderboard/history` was shadowed by `/leaderboard/:showId`; moved `/history` first. Toggle confirmed live (no restart needed). UI confirmed: no BG tab, button, or selector visible in browser while mode is enabled. |
| B — Write validation       | Pass | Fixed missing `count` field defaulting to 1 instead of returning 400; all boundary cases now correct. |
| C — Lineup ownership       | Pass | Other user's card → 403; non-existent card → 400; own card → 200. |
| D — Annual UR grant        | Pass | All 3 users gained exactly +1 ticket; second run was no-op (idempotent). |
| E — Feature 001 (1–10)     | Pass | All 10 scenarios pass. Two bugs found and fixed during the run: (1) `/leaderboard/history` shadowed by `/:showId` — fixed route order; (2) missing banner pull `count` defaulted to 1 instead of 400 — fixed. No regressions. |
</content>
