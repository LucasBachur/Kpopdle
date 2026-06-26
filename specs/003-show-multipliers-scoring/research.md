# Research: Show Multipliers & Scoring Completeness

**Phase**: 0 — Pre-Design Research
**Date**: 2026-06-23
**Feature**: [spec.md](spec.md)

---

## Decision 1: New table name for multiplier templates

**Decision**: `show_schedule_multipliers` — a table linking multiplier definitions to `show_schedules` rows.

**Rationale**: Mirrors the existing `show_multipliers` naming convention (which links to `shows`). Making the relationship explicit in the name avoids confusion between the template table and the per-show instance table. The `schedule_id` FK replaces `show_id`, giving a symmetric naming pair: `show_schedule_multipliers` (templates) → `show_multipliers` (instances).

**Alternatives considered**:
- `multiplier_templates` — less clear that templates belong to schedules specifically.
- Overloading `show_multipliers` with a nullable `show_id` and a nullable `schedule_id` — adds NULLable FK complexity and makes queries ambiguous; rejected.

---

## Decision 2: same_group sub-type sentinel value

**Decision**: `applies_to_value = 'any'` triggers the lineup homogeneity check (all cards must share the same group). Any other non-null string (e.g., `'TWICE'`) triggers the specific-group match (cards from that named group earn the bonus regardless of lineup composition).

**Rationale**: Reuses the existing `applies_to_value TEXT` column already present in both `show_multipliers` and `show_schedule_multipliers`. No schema change required. The sentinel `'any'` is human-readable in the DB and operator scripts.

**Alternatives considered**:
- Separate boolean column `is_homogeneity_check` — adds a column for a distinction already expressible via the value field; rejected.
- `NULL` as the homogeneity sentinel — NULL semantics are ambiguous and break the unique constraint; rejected.

**Required code fix**: The existing `isMultiplierApplicable` in `backend/services/showService.js` treats all `same_group` multipliers as homogeneity checks (ignores `appliesToValue`). Must be updated to branch on `appliesToValue`:
- `appliesToValue === 'any'` → homogeneity: `groups.size === 1`
- else → specific group: `lineupSlots.some(s => s.group?.toLowerCase() === val)`

---

## Decision 3: Chemistry bonus formula

**Decision**: `chemistry_ratio(n, G) = n >= G ? 1.0 : (n <= 1 ? 0 : 1 - Math.pow(0.5, n - 1))`

Where `n` = number of same-group cards in the lineup, `G` = total idol count for that group in the `idols` table.

This produces:
| n | Example (aespa, G=4) | Ratio |
|---|----------------------|-------|
| 0 or 1 | 1 aespa card | 0% |
| 2 | 1 groupmate | 50% |
| 3 | 2 groupmates | 75% |
| 4 = G | all 4 aespa | 100% |

For TWICE (G=9): n=2→50%, n=3→75%, n=4→87.5%, …, n=9→100% — smooth curve as described in the spec.

The chemistry bonus applied to the lineup's final score: `score *= (1 + chemistry_ratio × chemistry_max_bonus)`

**Rationale**: Matches exactly the values given by the user in the spec. The `Math.pow(0.5, n-1)` factor produces natural diminishing returns. The `n >= G` cap cleanly handles the "full group = 100%" invariant regardless of group size.

**Alternatives considered**:
- `log(n) / log(G)` — does not produce the exact 50/75/100 values described; rejected.
- Storing the curve as a lookup table in gacha_config — adds config complexity for a formula that's fixed by design; rejected.

**Chemistry max bonus default**: `chemistry_max_bonus = 0.15` (15%). Added to `gacha_config`. Operator-tunable without code changes.

---

## Decision 4: Group size lookup for chemistry

**Decision**: At resolution time, query the `idols` table for group sizes via `SELECT "group", COUNT(*)::int AS cnt FROM idols GROUP BY "group"`. Build an in-memory map `{ groupName → memberCount }` and pass it into `calculateScore`. No new table needed.

**Rationale**: Group sizes change rarely. A single query at show resolution time is cheap. The `slots` array already carries `idol.group` for each card — the size map is the only additional lookup.

For the **frontend chemistry preview**: add `groupSize` to the player cards query in `db.js` via a correlated subquery: `(SELECT COUNT(*) FROM idols i2 WHERE i2."group" = i."group")::int AS "groupSize"`. This gives `LineupBuilder` everything it needs to compute chemistry client-side without extra API calls.

**Alternatives considered**:
- Caching group sizes in gacha_config — stale risk; rejected.
- Computing group sizes from the player's owned cards (rather than the full `idols` table) — would under-count groups where the player doesn't own all members; rejected.

---

## Decision 5: Migration approach

**Decision**: New standalone script `backend/migrate-show-multipliers.js` following the `migrate-card-game.js` pattern (own Pool, BEGIN/COMMIT, `CREATE TABLE IF NOT EXISTS`, exit non-zero on failure).

**Rationale**: Keeps migrations incremental and independently runnable. The existing `migrate-card-game.js` has already run in production; adding a new table there would require re-running a larger migration safely. A dedicated script is simpler.

**What it does**: `CREATE TABLE IF NOT EXISTS show_schedule_multipliers (...)` with the unique constraint `(schedule_id, applies_to_type, applies_to_value)` that makes the seed script idempotent.

---

## Decision 6: Multiplier copying at show creation

**Decision**: Modify `createTodayShows()` in `backend/scheduler.js`. After `getOrCreateTodayShow(...)` returns a new show, call `copyScheduleMultipliers(show.id, schedule.id)` — a new `db.js` function that `INSERT INTO show_multipliers SELECT $1, label, multiplier_value, applies_to_type, applies_to_value FROM show_schedule_multipliers WHERE schedule_id = $2 ON CONFLICT DO NOTHING`.

**Rationale**: The scheduler already has `schedule.id` at the point of show creation. The copy is idempotent (`ON CONFLICT DO NOTHING` on `show_multipliers` — or simply a guard that the show has no multipliers yet). Existing shows created before this feature ships are unaffected.

**Alternatives considered**:
- Copy at resolution time — too late for the player-facing label display; rejected.
- A separate cron job — unnecessary indirection when show creation already has the needed data; rejected.

---

## Decision 7: Tie-handling fix

**Decision**: Replace sequential `rank = i + 1` in `assignRanksAndRewards` with standard competition ranking:

```js
let currentRank = 1;
for (let i = 0; i < entries.length; i++) {
  if (i > 0 && entries[i].finalScore < entries[i - 1].finalScore) {
    currentRank = i + 1; // skip ranks for the tied group above
  }
  // percentile uses currentRank (not array index) for reward tier
  const percentile = currentRank / total;
  ...
}
```

Entries are already sorted `ORDER BY final_score DESC`, so this is a single-pass O(n) fix.

**Rationale**: Standard competition ranking (1224 style) is the correct and expected behaviour. The fix is minimal — two lines changed, one line added.

---

## Decision 8: Multiplier labels on lineup page

**Decision**: Modify `GET /api/card-game/shows/today` to include a `multipliers` array per show containing `{ label }` objects only (no `multiplier_value`). The `LineupPage` fetches this endpoint and renders a "Today's Bonuses" panel. After the show resolves, the endpoint returns the next pending show's data (or empty array if no show is scheduled).

**Implementation**: Add a helper in `cardGame.js` that queries shows ordered by `deadline DESC` where `(date = today AND resolution_status = 'pending') OR (date = tomorrow AND resolution_status = 'pending')`, limited to 1 row. Return its multipliers.

**Rationale**: Reuses the existing shows infrastructure. The frontend doesn't need a new endpoint — just an enriched version of what already exists.

---

## Decision 9: Seed script default multiplier templates

**Decision**: One template per show, varied by type to give each show a distinct strategic identity:

| Show | Day | Type | applies_to_value | Label | Value |
|------|-----|------|-----------------|-------|-------|
| Show Champion | Wed | role | vocalist | +Vocalist | 1.15 |
| M Countdown | Thu | role | rapper | +Rapper | 1.15 |
| Music Bank | Fri | role | dancer | +Dancer | 1.15 |
| Music Core | Sat | company | SM Entertainment | +SM Ent | 1.20 |
| Inkigayo | Sun | same_group | any | +Group Synergy | 1.25 |

**Rationale**: Each of the three role types (vocalist, rapper, dancer) gets its own show. One company bonus (SM Entertainment — present in the GG roster) adds a collection-building angle. The same_group homogeneity bonus on Inkigayo (the most popular show) rewards full-group lineups on the biggest stage. Values are operator-editable via the script.
