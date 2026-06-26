# Quickstart Validation Guide: Show Multipliers & Scoring Completeness

**Phase**: 1 — Design
**Date**: 2026-06-23
**Feature**: [spec.md](spec.md) | [data-model.md](data-model.md) | [contracts/operator-cli.md](contracts/operator-cli.md)

This guide describes how to validate that feature 003 works end-to-end after implementation. Each scenario maps to the user stories in the spec. Use these as acceptance checkpoints — not automated tests.

---

## Prerequisites

- `DATABASE_URL` set in `backend/.env`
- All prior migrations and seeds run: `migrate-card-game.js`, `seed-shows.js`
- Feature 003 migration and seeds run (see Scenario 1)
- At least one GG idol group with ≥ 2 members in `idols` table
- A card definition exists for each idol used in tests
- At least one player account registered

---

## Scenario 1 — Operator runs migration and seed (US1, SC-001, SC-006)

**Goal**: Show schedules have multiplier templates; re-running is safe.

```bash
node backend/migrate-show-multipliers.js
node backend/seed-gacha-config.js
node backend/seed-multiplier-templates.js
```

**Expected output (first run)**:
```
Migration complete — show_schedule_multipliers ready.
  + Show Champion: +Vocalist
  + M Countdown: +Rapper
  + Music Bank: +Dancer
  + Music Core: +SM Ent
  + Inkigayo: +Group Synergy
Done — 5 inserted, 0 already present.
```

**Verify in DB**:
```sql
SELECT ss.show_name, ssm.label, ssm.applies_to_type, ssm.applies_to_value, ssm.multiplier_value
FROM show_schedule_multipliers ssm
JOIN show_schedules ss ON ss.id = ssm.schedule_id
ORDER BY ss.day_of_week;
```
Expected: 5 rows, one per GG show schedule.

**Re-run seed** (SC-006):
```bash
node backend/seed-multiplier-templates.js
```
Expected output: all lines show `= already present`. Row count in DB unchanged.

---

## Scenario 2 — Scheduler creates show with multipliers (US1 SC-002, FR-004)

**Goal**: A newly created show inherits templates from its schedule.

Trigger show creation manually (or wait for the 03:00 UTC cron):
```bash
# Force-run by starting the server and waiting, or calling createTodayShows() directly
node -e "require('dotenv').config(); const {initScheduler} = require('./backend/scheduler'); initScheduler();"
```

**Verify in DB** (run after today's show exists):
```sql
SELECT s.show_name, s.date, sm.label, sm.applies_to_type
FROM shows s
JOIN show_multipliers sm ON sm.show_id = s.id
WHERE s.date = CURRENT_DATE AND s.gender_category = 'gg';
```
Expected: the today's GG show has at least 1 row in `show_multipliers`.

**Verify no-template show doesn't error** (FR-005): if a `show_schedules` row exists with no template, show creation must still succeed and the show resolves normally.

---

## Scenario 3 — Scoring applies multipliers (US2, SC-003)

**Goal**: A lineup matching the day's bonus category scores higher than an equal-stat lineup that doesn't match.

**Setup**:
1. Ensure today's show has a `+Rapper` template (M Countdown day or use any seeded show with a role multiplier).
2. Register two players: Player A and Player B.
3. Give Player A a lineup of all `rapper`-role idols.
4. Give Player B a lineup of the same number of idols with identical `current_stat` values but no `rapper` role.
5. Save both lineups for today's show.

**Trigger resolution** (advance clock past deadline or use psql to set `deadline = NOW() - interval '1 minute'`):
```sql
UPDATE shows SET deadline = NOW() - interval '1 minute'
WHERE date = CURRENT_DATE AND gender_category = 'gg';
```
Wait up to 60 seconds for the resolution cron to fire, then:
```sql
SELECT se.user_id, se.base_score, se.final_score, se.rank
FROM show_entries se
JOIN shows s ON s.id = se.show_id
WHERE s.date = CURRENT_DATE AND s.gender_category = 'gg'
ORDER BY se.final_score DESC;
```
**Expected**: Player A's `final_score` > Player B's `final_score` (before random variance). Because both have identical base stats, the multiplier is the only differentiator. SC-003: at least 10% gap at 1.15× multiplier.

**No-penalty check (FR-008)**: Player B's score must not be lower than their base score. Non-matching cards must score at exactly 1× — the multiplier must never reduce a score below baseline. Verify:
```sql
SELECT se.user_id, se.base_score, se.final_score,
       ROUND(se.final_score::numeric / se.base_score, 4) AS multiplier_applied
FROM show_entries se
JOIN shows s ON s.id = se.show_id
WHERE s.date = CURRENT_DATE AND s.gender_category = 'gg'
ORDER BY se.final_score DESC;
```
**Expected**: Player B's `multiplier_applied` is ≥ 1.0 (or within random variance above 1.0). A value significantly below 1.0 indicates the non-matching multiplier was applied as a penalty — this is a bug.

---

## Scenario 4 — Chemistry bonus applies (US5, SC-007, SC-008)

**Goal**: A group-cohesion lineup scores higher; a mixed lineup scores the same as without chemistry.

**Setup**:
1. Use a show with **no** role/company multipliers (or use Inkigayo's same_group=any which gives a separate multiplier — use a custom show for isolation).
2. Player A: lineup of 2+ cards from the same group (e.g., 2 aespa members). Same total `current_stat` as Player B.
3. Player B: lineup of cards from different groups (no group with ≥ 2 cards). Same total `current_stat` as Player A.

**After resolution**:
```sql
SELECT se.user_id, se.base_score, se.final_score
FROM show_entries se JOIN shows s ON s.id = se.show_id
WHERE s.date = CURRENT_DATE AND s.gender_category = 'gg';
```
**Expected**: Player A's `final_score` > Player B's `final_score` (chemistry bonus applied). SC-008: Player B's score is the same as if chemistry didn't exist (no penalty).

**Full-group chemistry** (SC-007): If Player A has ALL members of a group (e.g., all 4 aespa members), their chemistry_ratio = 1.0 → chemistry_multiplier = 1.15 (with default `chemistry_max_bonus = 0.15`). Verify the score difference equals exactly that multiplier (before random variance).

---

## Scenario 5 — Tied scores share rank (US4, SC-005)

**Goal**: Two players with identical final scores get the same rank and reward tier.

**Setup**: Seed two show entries with identical `final_score` directly:
```sql
-- After a show is created but before resolution
INSERT INTO show_entries (show_id, user_id, song_id, card_snapshot, base_score, final_score)
VALUES ($show_id, $user_a_id, $song_id, '[]', 1000, 1000),
       ($show_id, $user_b_id, $song_id, '[]', 1000, 1000);
```
Trigger resolution (set deadline in the past, wait for cron).

**Verify**:
```sql
SELECT user_id, final_score, rank, reward_rarity
FROM show_entries WHERE show_id = $show_id ORDER BY rank;
```
**Expected**:
- Both players have `rank = 1`.
- Both have the same `reward_rarity`.
- If a third player had `final_score = 800`, their `rank = 3` (not 2).

---

## Scenario 6 — Multiplier labels shown on lineup page (US3, SC-004)

**Goal**: Player sees label chips on the lineup page; no numeric values visible.

**Steps**:
1. Start the dev server (`npm run dev` in `frontend/`, `npm start` in `backend/`).
2. Log in as a player and navigate to `/card-game/lineup`.
3. Confirm a "Today's Bonuses" section appears showing at least one chip (e.g., `+Rapper`).
4. Inspect the DOM / network response — confirm no numeric multiplier value is present anywhere on the page or in the API response's `multiplierLabels` array.
5. After the show resolves, reload the page — confirm labels switch to the next pending show's labels. If the next show hasn't been created yet by the scheduler (the 03:00 UTC cron hasn't run), no bonus section will appear — this is correct and expected, not a bug. Wait for the cron to run and revalidate if needed.

---

## Scenario 7 — Live chemistry preview updates (US5 FR-022, SC-009)

**Goal**: Chemistry preview appears and updates as cards are added/swapped in the lineup builder.

**Steps**:
1. Navigate to `/card-game/lineup` with a player who owns ≥ 2 cards from the same group.
2. Open the lineup builder. No chemistry section should be visible initially (no group has 2+ slots filled).
3. Add a first card from Group A to a slot. Still no chemistry section.
4. Add a second card from Group A to another slot. A chemistry section appears: `"Group A: 50% Chemistry"`.
5. If Group A has 4 members total and you add a third card from Group A: `"Group A: 75% Chemistry"`.
6. Swap a Group A card out for a card from Group B. Verify the display recalculates immediately.
7. Remove all Group A cards. Chemistry section disappears entirely (not zero — absent).

---

## Scenario 8 — same_group specific-group bonus (US2 Scenario 3)

**Goal**: A show with a specific-group bonus (e.g., `applies_to_value = 'TWICE'`) rewards only TWICE cards, regardless of lineup composition.

**Setup**: Manually insert a `show_multipliers` row for today's show:
```sql
INSERT INTO show_multipliers (show_id, label, multiplier_value, applies_to_type, applies_to_value)
VALUES ($show_id, '+TWICE', 1.20, 'same_group', 'TWICE');
```
Build a mixed lineup with some TWICE cards and some non-TWICE cards. Resolve the show.

**Expected**: TWICE cards in the lineup contribute at 1.20× while non-TWICE cards contribute at 1×. A full-TWICE lineup scores higher than a partial-TWICE lineup of the same total stat. A non-TWICE lineup is unaffected.

---

## Success Criteria mapping

| SC | Validated by |
|----|-------------|
| SC-001 | Scenario 1 — DB query after seed |
| SC-002 | Scenario 2 — DB query after show creation |
| SC-003 | Scenario 3 — score comparison |
| SC-004 | Scenario 6 — UI inspection |
| SC-005 | Scenario 5 — rank/reward query |
| SC-006 | Scenario 1 (re-run) |
| SC-007 | Scenario 4 — full-group score comparison |
| SC-008 | Scenario 4 — no-cohesion baseline |
| SC-009 | Scenario 7 — live UI interaction |
