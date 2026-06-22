# Quickstart: Weekly Song Pool & Rotation

**Phase**: 1 — Design | **Feature**: [spec.md](spec.md)

End-to-end validation scenarios that prove this feature works. No automated test framework is in place (consistent with feature 001); these are runnable manual checks mapped to the user stories and success criteria. See [contracts/operator-cli.md](contracts/operator-cli.md) and [contracts/scheduler.md](contracts/scheduler.md) for the interfaces exercised.

## Prerequisites

- `backend/migrate-card-game.js` already applied (all card-game tables exist).
- Base catalog present: `idols` (with `roles`), `songs` with `group_type` and `member_count`, and an operator-inserted card catalog (cards/stats are out of scope — inserted directly).
- `DATABASE_URL` set in `backend/.env`.
- Seed the new config key:

```bash
node backend/seed-gacha-config.js   # adds weekly_pool_size = 25 (idempotent)
```

A "week" is the ART Monday (`getMonday()`); `weekly_song_pools.week_start_date` is that date.

---

## Scenario 1 — Operator establishes a playable pool (US1)

```bash
node backend/confirm-idol-roles.js          # report idols missing role tags; fill gaps via DB inserts
node backend/establish-weekly-pool.js gg     # create current-week GG pool
```

**Expect**:
- `confirm-idol-roles.js` lists any idol with empty `roles` (or confirms none missing); it writes nothing. *(FR-003, US1-4)*
- `establish-weekly-pool.js` reports a GG pool **created** at size 25 (or under-target with both numbers), drawn only from eligible songs. *(FR-001, FR-004, US1-1)*
- Register a new player and open the lineup screen (`GET /songs/weekly?genderCategory=gg`): the pool shows 25 songs, each with its `memberCount`; the player can fill every slot and save a valid lineup. *(SC-001, SC-002, US1-2)*

**Verify in DB**:
```sql
SELECT count(*) FROM weekly_song_pools
WHERE week_start_date = <this ART Monday> AND gender_category = 'gg';   -- = 25 (or all eligible if fewer)
```

---

## Scenario 2 — Establishment is idempotent (US1-3 / SC-003)

```bash
node backend/establish-weekly-pool.js gg
node backend/establish-weekly-pool.js gg     # second run
```

**Expect**: second run reports **already present / unchanged**; the row count for the week is identical to the first run. *(FR-002, SC-003)*

---

## Scenario 3 — Weekly rotation produces a fresh pool (US2 / SC-004, SC-005)

Simulate a new week (e.g., fast-forward server clock, or temporarily invoke `rotateAllGenders()` after setting up a previous-week pool):

1. Ensure a pool exists for **last** week (insert rows at `week_start_date = thisMonday − 7`).
2. Trigger rotation for the current week (startup catch-up, the Monday cron, or a direct call).

**Expect**:
- A new pool exists for the current Monday at size 25. *(FR-005)*
- With ≥ 25 fresh eligible songs: **zero** songs shared with last week's pool. *(FR-006, SC-005)*
- With < 25 fresh eligible songs: pool still reaches 25 by reusing previous-week songs. *(FR-006, SC-005)*
- `GET /songs/weekly?genderCategory=gg` now returns the new week's songs, not last week's; last week's rows are preserved. *(US2-4, SC-004)*

**Verify zero overlap (fresh case)**:
```sql
SELECT count(*) FROM weekly_song_pools a
JOIN weekly_song_pools b
  ON a.song_id = b.song_id AND a.gender_category = b.gender_category
WHERE a.week_start_date = <thisMonday>
  AND b.week_start_date = <thisMonday - 7>;   -- = 0 when enough fresh songs exist
```

---

## Scenario 4 — Rotation idempotency & catch-up (US2-3 / SC-007 / FR-010)

```bash
# Run rotation twice for the same week (or restart the server twice).
```

**Expect**: the second rotation leaves the pool and lineup flags unchanged (row count and `is_valid` values identical). A server that was down at the Monday boundary creates the current week's pool on startup. *(FR-007, FR-010, SC-007)*

---

## Scenario 5 — Small / empty catalog (FR-008, FR-009, US2-5)

- **Under target**: with fewer than 25 eligible GG songs, rotation forms a pool from **all** eligible songs and logs an under-target condition rather than failing. *(FR-008, US2-5)*
- **Empty**: with zero eligible GG songs, rotation completes without error and does **not** remove or empty any existing pool. *(FR-009, edge: "No eligible songs at all")*

---

## Scenario 6 — Stale lineups flagged after rotation (US3 / SC-006)

1. As a player, save a lineup using song `X`.
2. Run a rotation whose new pool **excludes** `X`.

**Expect**:
- The player's lineup is now `is_valid = FALSE`. *(FR-011, US3-1)*
- A different player whose lineup song is still in the new pool remains `is_valid = TRUE`. *(FR-012, US3-2)*
- 100% of out-of-pool lineups flagged; 0% of in-pool lineups incorrectly flagged. *(SC-006)*

```sql
SELECT user_id, song_id, is_valid FROM lineups WHERE gender_category = 'gg';
```

3. The player saves a new lineup with an in-pool song.

**Expect**: `is_valid` returns to `TRUE` (handled by the existing save path). *(FR-013, US3-3)*

---

## Scenario 7 — BG scope guard (FR-014 / SC-008)

Even if a `bg` pool is formed (`node backend/establish-weekly-pool.js bg`), no player-facing GG-launch response returns it:

```bash
curl "<host>/api/card-game/songs/weekly?genderCategory=gg"   # contains only GG songs
```

**Expect**: BG songs never appear in any GG-launch player-facing response. *(FR-014, SC-008)*

---

## Success-criteria coverage

| Criterion | Scenario |
|-----------|----------|
| SC-001, SC-002 | 1 |
| SC-003 | 2 |
| SC-004, SC-005 | 3 |
| SC-007 | 4 |
| FR-008 / FR-009 | 5 |
| SC-006 | 6 |
| SC-008 | 7 |
